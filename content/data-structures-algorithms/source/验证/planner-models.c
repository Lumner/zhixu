#include "planner.h"
#include "planner-test.h"
#include <string.h>
static const char records[] = "DSA-CATALOG-1\n0\n30\nC basics\n17\n20\nArrays\n9999\n20\nGraphs\n";
static FILE *text_file(const char *text)
{
    FILE *stream = p_temp_file(); P_CHECK(stream != NULL);
    P_CHECK(fputs(text,stream) >= 0 && fflush(stream) == 0);
    rewind(stream); return stream;
}
static PStatus load(Planner *app, const char *catalog, const char *relations)
{
    FILE *a = text_file(catalog), *b = text_file(relations);
    PStatus status = planner_load(a,b,app);
    P_CHECK(fclose(a) == 0 && fclose(b) == 0);
    return status;
}
static int dag(unsigned mask)
{
    for (unsigned a = 0; a < 3; a++) for (unsigned b = 0; b < 3; b++) for (unsigned c = 0; c < 3; c++) {
        if (a == b || a == c || b == c) { continue; }
        unsigned order[] = {a,b,c}, rank[3];
        for (unsigned i = 0; i < 3; i++) { rank[order[i]] = i; }
        int valid = 1;
        for (unsigned u = 0; u < 3; u++) for (unsigned v = 0; v < 3; v++) {
            if ((mask & (1u << (u*3+v))) && rank[u] >= rank[v]) { valid = 0; }
        }
        if (valid) { return 1; }
    }
    return 0;
}
static size_t index_of(int id)
{
    if (id == 0) { return 0; }
    if (id == 17) { return 1; }
    P_CHECK(id == 9999); return 2;
}
static void ready_check(const Planner *app, unsigned graph, unsigned done_mask)
{
    int ids[] = {0,17,9999}, minutes[] = {30,20,20}, done[3]; size_t n = 0;
    for (size_t i = 0; i < 3; i++) { if (done_mask & (1u << i)) { done[n++] = ids[i]; } }
    int valid = 1;
    for (unsigned u = 0; u < 3; u++) for (unsigned v = 0; v < 3; v++) {
        if ((graph & (1u << (u*3+v))) && (done_mask & (1u << v)) && !(done_mask & (1u << u))) { valid = 0; }
    }
    PIds result, old; memset(&result,0x5a,sizeof(result)); memcpy(&old,&result,sizeof(old));
    PStatus status = planner_ready(app,done,n,&result);
    if (!valid) { P_CHECK(status == P_INVALID && memcmp(&result,&old,sizeof(result)) == 0); return; }
    P_CHECK(status == P_OK);
    int expected[3]; size_t count = 0;
    for (unsigned v = 0; v < 3; v++) {
        int blocked = (done_mask & (1u << v)) != 0;
        for (unsigned u = 0; u < 3; u++) {
            if ((graph & (1u << (u*3+v))) && !(done_mask & (1u << u))) { blocked = 1; }
        }
        if (!blocked) { expected[count++] = (int)v; }
    }
    for (size_t i = 0; i < count; i++) for (size_t j = i + 1; j < count; j++) {
        int a = expected[i], b = expected[j];
        if (minutes[a] > minutes[b] || (minutes[a] == minutes[b] && ids[a] > ids[b])) {
            expected[i] = b; expected[j] = a;
        }
    }
    P_CHECK(result.count == count);
    for (size_t i = 0; i < count; i++) { P_CHECK(result.ids[i] == ids[expected[i]]); }
}
int main(void)
{
    Planner app; planner_init(&app);
    char config[4096]; unsigned long ready_cases = 0;
    for (unsigned mask = 0; mask < 512; mask++) {
        strcpy(config,"DSA-RELATIONS-1\nC|42|-1|Root\nM|0|42\nM|17|42\nM|9999|42\nS|9999\nS|0\nS|17\n");
        int ids[] = {0,17,9999};
        for (unsigned u = 0; u < 3; u++) for (unsigned v = 0; v < 3; v++) {
            if (mask & (1u << (u*3+v))) {
                size_t used = strlen(config);
                (void)snprintf(config+used,sizeof(config)-used,"D|%d|%d\n",ids[u],ids[v]);
            }
        }
        unsigned char before[sizeof(app)]; memcpy(before,&app,sizeof(app));
        PStatus status = load(&app,records,config);
        if (!dag(mask)) { P_CHECK(status == P_CYCLE && memcmp(before,&app,sizeof(app)) == 0); continue; }
        P_CHECK(status == P_OK);
        PIds order; P_CHECK(planner_order(&app,&order) == P_OK && order.count == 3);
        unsigned rank[3], seen = 0;
        for (size_t i = 0; i < 3; i++) { size_t vertex = index_of(order.ids[i]); P_CHECK(!(seen & (1u << vertex))); seen |= 1u << vertex; rank[vertex] = (unsigned)i; }
        for (unsigned u = 0; u < 3; u++) for (unsigned v = 0; v < 3; v++) {
            if (mask & (1u << (u*3+v))) { P_CHECK(rank[u] < rank[v]); }
        }
        for (unsigned done = 0; done < 8; done++) { ready_check(&app,mask,done); ready_cases++; }
    }
    for (unsigned code = 0; code < 64; code++) {
        strcpy(config,"DSA-RELATIONS-1\nP|202|Library\nP|0|Desk\nP|9999|Gate\n");
        unsigned rest = code; int weight[3][3] = {{0}}, has[3][3] = {{0}}, ids[] = {202,0,9999};
        for (size_t u = 0; u < 3; u++) for (size_t v = u + 1; v < 3; v++) {
            unsigned state = rest % 4; rest /= 4;
            if (state != 0) {
                int w = state == 1 ? 0 : state == 2 ? 2 : 5;
                has[u][v] = has[v][u] = 1; weight[u][v] = weight[v][u] = w;
                size_t used = strlen(config); (void)snprintf(config+used,sizeof(config)-used,"R|%d|%d|%d\n",ids[u],ids[v],w);
            }
        }
        P_CHECK(load(&app,"DSA-CATALOG-1\n",config) == P_OK);
        for (size_t u = 0; u < 3; u++) for (size_t v = 0; v < 3; v++) {
            int cost = u == v ? 0 : has[u][v] ? weight[u][v] : 10000;
            for (size_t k = 0; k < 3; k++) {
                if (has[u][k] && has[k][v] && weight[u][k]+weight[k][v] < cost) { cost = weight[u][k]+weight[k][v]; }
            }
            PRoute route; P_CHECK(planner_route(&app,ids[u],ids[v],&route) == P_OK);
            P_CHECK(route.reachable == (cost != 10000));
            if (!route.reachable) { P_CHECK(route.count == 0 && route.cost == 0); continue; }
            P_CHECK(route.cost == cost && route.count >= 1 && route.count <= 3);
            P_CHECK(route.ids[0] == ids[u] && route.ids[route.count-1] == ids[v]);
            int total = 0; unsigned seen = 0;
            for (size_t i = 0; i < route.count; i++) {
                size_t p = 0; while (p < 3 && ids[p] != route.ids[i]) { p++; }
                P_CHECK(p < 3 && !(seen & (1u << p))); seen |= 1u << p;
                if (i != 0) {
                    size_t q = 0; while (q < 3 && ids[q] != route.ids[i-1]) { q++; }
                    P_CHECK(q < 3 && has[q][p]); total += weight[q][p];
                }
            }
            P_CHECK(total == cost);
        }
    }
    unsigned long category_cases = 0; unsigned combinations = 1;
    for (size_t n = 0; n <= 4; n++) {
        combinations = 1; for (size_t i = 0; i < n; i++) { combinations *= (unsigned)n+1; }
        for (unsigned code = 0; code < combinations; code++) {
            strcpy(config,"DSA-RELATIONS-1\n"); unsigned rest = code; int parent[4], roots = 0, valid = 1;
            for (size_t i = 0; i < n; i++) {
                parent[i] = (int)(rest % (n+1)) - 1; rest /= (unsigned)n+1;
                if (parent[i] == -1) { roots++; }
                size_t used = strlen(config);
                (void)snprintf(config+used,sizeof(config)-used,"C|%zu|%d|Class%zu\n",i,parent[i],i);
            }
            if (n != 0 && roots != 1) { valid = 0; }
            for (size_t i = 0; i < n; i++) {
                unsigned seen = 0; int p = (int)i;
                while (p != -1) { if (seen & (1u << p)) { valid = 0; break; } seen |= 1u << p; p = parent[p]; }
            }
            PStatus status = load(&app,"DSA-CATALOG-1\n",config);
            P_CHECK((status == P_OK) == valid);
            if (valid) {
                PCategoryView view; P_CHECK(planner_categories(&app,&view) == P_OK && view.count == n);
                unsigned seen = 0;
                for (size_t i = 0; i < n; i++) {
                    size_t p = view.positions[i]; P_CHECK(p < n && !(seen & (1u << p)));
                    if (parent[p] == -1) { P_CHECK(view.depths[i] == 0); }
                    else { P_CHECK(seen & (1u << parent[p])); }
                    size_t depth = 0; int q = parent[p]; while (q != -1) { depth++; q = parent[q]; }
                    P_CHECK(view.depths[i] == depth); seen |= 1u << p;
                }
            }
            category_cases++;
        }
    }
    P_CHECK(load(&app,records,"DSA-RELATIONS-1\nC|42|-1|Root\nM|0|42\nM|17|42\nM|9999|42\nS|9999\nS|17\nS|0\n") == P_OK);
    PRecords view, title; P_CHECK(planner_view(&app,&view) == P_OK);
    size_t comparisons = view.stats.comparisons, writes = view.stats.writes;
    P_CHECK(view.count == 3 && view.records[0].id == 17 && view.records[1].id == 9999 && view.records[2].id == 0);
    P_CHECK(planner_title(&app,"a",&title) == P_OK);
    size_t count = 0;
    for (size_t i = 0; i < 3; i++) {
        IRecord *row = &app.catalog.records[i];
        if (strstr(row->title,"a") != NULL) { P_CHECK(title.records[count++].id == row->id); }
    }
    P_CHECK(title.count == count);
    P_CHECK(planner_set_minutes(&app,9999,0) == P_OK);
    PIds ready; P_CHECK(planner_ready(&app,NULL,0,&ready) == P_OK && ready.ids[0] == 9999);
    P_CHECK(planner_view(&app,&view) == P_OK && view.records[0].id == 9999);
    FILE *saved = p_temp_file(), *relation = text_file("DSA-RELATIONS-1\nC|42|-1|Root\nM|0|42\nM|17|42\nM|9999|42\n");
    P_CHECK(saved != NULL && planner_export(saved,&app) == P_OK); rewind(saved);
    Planner reloaded; planner_init(&reloaded);
    P_CHECK(planner_load(saved,relation,&reloaded) == P_OK);
    IRecord row; P_CHECK(planner_find(&reloaded,9999,&row) == P_OK && row.minutes == 0);
    P_CHECK(fclose(saved) == 0 && fclose(relation) == 0);
    planner_clear(&reloaded); planner_clear(&app);
    printf("dependency_graphs=512 ready_cases=%lu route_graphs=64 route_queries=576 category_cases=%lu reload=1 sort_comparisons=%zu sort_writes=%zu\n",ready_cases,category_cases,comparisons,writes);
    return 0;
}
