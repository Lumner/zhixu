#include "planner.h"
#include "planner-test.h"
#include <string.h>
static const char small_catalog[] = "DSA-CATALOG-1\n0\n30\nC basics\n17\n30\nArrays\n9\n20\nPointers\n9999\n15\nGraphs\n";
static const char small_relations[] = "DSA-RELATIONS-1\nC|0|-1|Root\nM|0|0\nM|17|0\nM|9|0\nM|9999|0\nS|17\nS|9\nS|0\nD|0|17\nD|0|9\nP|0|Desk\n";
static FILE *text_file(const char *text)
{
    FILE *stream = p_temp_file(); P_CHECK(stream != NULL);
    P_CHECK(fputs(text,stream) >= 0 && fflush(stream) == 0); rewind(stream); return stream;
}
static PStatus load(Planner *app, const char *a, const char *b)
{
    FILE *in = text_file(a), *links = text_file(b);
    PStatus status = planner_load(in,links,app);
    P_CHECK(fclose(in) == 0 && fclose(links) == 0); return status;
}
int main(int argc, char **argv)
{
    P_CHECK(argc == 3);
    Planner app; planner_init(&app);
    P_CHECK(load(&app,small_catalog,small_relations) == P_OK);
    char catalog[8192] = "DSA-CATALOG-1\n", links[8192] = "DSA-RELATIONS-1\nC|0|-1|Root\n";
    for (int i = 0; i < 32; i++) {
        size_t used = strlen(catalog); (void)snprintf(catalog+used,sizeof(catalog)-used,"%d\n%d\nTitle %d\n",i,i,i);
        used = strlen(links); (void)snprintf(links+used,sizeof(links)-used,"M|%d|0\n",i);
    }
    Planner trial; planner_init(&trial);
    size_t start = p_attempts;
    P_CHECK(load(&trial,catalog,links) == P_OK);
    size_t load_allocations = p_attempts - start;
    planner_clear(&trial);
    size_t baseline = p_live;
    unsigned char before[sizeof(app)]; memcpy(before,&app,sizeof(app));
    for (size_t i = 0; i < load_allocations; i++) {
        p_fail_after((long)i);
        P_CHECK(load(&app,catalog,links) == P_MEMORY);
        p_fail_after(-1);
        P_CHECK(p_live == baseline && memcmp(before,&app,sizeof(app)) == 0);
    }
    P_CHECK(load_allocations >= 5);
    PRecords view, old; memset(&view,0x5a,sizeof(view)); memcpy(&old,&view,sizeof(old));
    p_fail_after(0); P_CHECK(planner_view(&app,&view) == P_MEMORY); p_fail_after(-1);
    P_CHECK(memcmp(&view,&old,sizeof(view)) == 0 && p_live == baseline);
    FILE *out = p_temp_file(); P_CHECK(out != NULL);
    start = p_attempts; P_CHECK(planner_export(out,&app) == P_OK);
    size_t export_allocations = p_attempts - start; P_CHECK(fclose(out) == 0);
    for (size_t i = 0; i < export_allocations; i++) {
        out = p_temp_file(); P_CHECK(out != NULL); p_fail_after((long)i);
        P_CHECK(planner_export(out,&app) == P_MEMORY); p_fail_after(-1);
        P_CHECK(ftell(out) == 0 && p_live == baseline); P_CHECK(fclose(out) == 0);
    }
    size_t io_cases = 0;
    for (int which = 0; which < 2; which++) {
        FILE *a = text_file(small_catalog), *b = text_file(small_relations);
        p_read_fail(which == 0 ? a : b,10);
        P_CHECK(planner_load(a,b,&app) == P_IO); p_io_reset();
        P_CHECK(memcmp(before,&app,sizeof(app)) == 0 && p_live == baseline);
        P_CHECK(fclose(a) == 0 && fclose(b) == 0); io_cases++;
    }
    for (size_t nth = 1; nth <= 2; nth++) {
        p_close_fail(nth);
        P_CHECK(planner_load_files(argv[1],argv[2],&app) == P_IO); p_io_reset();
        P_CHECK(p_open_streams == 0 && p_live == baseline && memcmp(before,&app,sizeof(app)) == 0); io_cases++;
    }
    P_CHECK(planner_load_files("file-that-does-not-exist",argv[2],&app) == P_IO);
    P_CHECK(planner_load_files(argv[1],"file-that-does-not-exist",&app) == P_IO);
    P_CHECK(p_open_streams == 0 && memcmp(before,&app,sizeof(app)) == 0); io_cases += 2;
    for (long successes = 0; successes <= 2; successes++) {
        out = p_temp_file(); P_CHECK(out != NULL); p_write_fail(out,successes);
        P_CHECK(planner_export(out,&app) == P_IO); p_io_reset();
        P_CHECK(memcmp(before,&app,sizeof(app)) == 0 && p_live == baseline);
        P_CHECK(fclose(out) == 0); io_cases++;
    }
    out = p_temp_file(); P_CHECK(out != NULL); p_flush_fail(out);
    P_CHECK(planner_export(out,&app) == P_IO); p_io_reset();
    P_CHECK(fclose(out) == 0 && memcmp(before,&app,sizeof(app)) == 0); io_cases++;
    PIds ids, old_ids; memset(&ids,0x5a,sizeof(ids)); memcpy(&old_ids,&ids,sizeof(ids));
    int done[] = {0,0}, missing[] = {9999}, broken[] = {17};
    P_CHECK(planner_ready(&app,done,2,&ids) == P_DUPLICATE);
    P_CHECK(planner_ready(&app,missing,1,&ids) == P_MISSING);
    P_CHECK(planner_ready(&app,broken,1,&ids) == P_INVALID);
    P_CHECK(planner_ready(&app,NULL,1,&ids) == P_INVALID);
    P_CHECK(planner_ready(&app,done,9,&ids) == P_LIMIT);
    P_CHECK(memcmp(&ids,&old_ids,sizeof(ids)) == 0);
    IRecord row, old_row; memset(&row,0x5a,sizeof(row)); memcpy(&old_row,&row,sizeof(row));
    P_CHECK(planner_find(&app,55,&row) == P_MISSING);
    P_CHECK(planner_find(&app,-1,&row) == P_LIMIT);
    P_CHECK(memcmp(&row,&old_row,sizeof(row)) == 0);
    P_CHECK(planner_set_minutes(&app,55,2) == P_MISSING);
    P_CHECK(planner_set_minutes(&app,0,1441) == P_LIMIT);
    P_CHECK(memcmp(before,&app,sizeof(app)) == 0);
    P_CHECK(load(&app,small_catalog,"DSA-RELATIONS-1\nC|0|-1|Root\n") == P_MISSING);
    P_CHECK(load(&app,small_catalog,"BAD\n") == P_FORMAT);
    P_CHECK(memcmp(before,&app,sizeof(app)) == 0 && p_live == baseline);
    PRoute route, old_route; memset(&route,0x5a,sizeof(route)); memcpy(&old_route,&route,sizeof(route));
    P_CHECK(planner_route(&app,0,9999,&route) == P_MISSING);
    P_CHECK(memcmp(&route,&old_route,sizeof(route)) == 0);
    char long_pattern[66]; memset(long_pattern,'a',65); long_pattern[65] = '\0';
    P_CHECK(planner_title(&app,long_pattern,&view) == P_LIMIT);
    P_CHECK(memcmp(&view,&old,sizeof(view)) == 0);
    P_CHECK(planner_load(NULL,NULL,&app) == P_INVALID);
    P_CHECK(planner_load_files(NULL,NULL,&app) == P_INVALID);
    P_CHECK(planner_view(NULL,&view) == P_INVALID && planner_view(&app,NULL) == P_INVALID);
    P_CHECK(planner_title(NULL,"",&view) == P_INVALID && planner_title(&app,NULL,&view) == P_INVALID);
    P_CHECK(planner_find(NULL,0,&row) == P_INVALID && planner_find(&app,0,NULL) == P_INVALID);
    P_CHECK(planner_categories(&app,NULL) == P_INVALID && planner_order(&app,NULL) == P_INVALID);
    P_CHECK(planner_ready(&app,NULL,0,NULL) == P_INVALID);
    P_CHECK(planner_route(NULL,0,0,NULL) == P_INVALID);
    P_CHECK(planner_export(NULL,&app) == P_INVALID && planner_set_minutes(NULL,0,1) == P_INVALID);
    int number = 99;
    P_CHECK(planner_number("",9999,&number) == P_FORMAT && number == 99);
    P_CHECK(planner_number("-1",9999,&number) == P_FORMAT && number == 99);
    P_CHECK(planner_number("10000",9999,&number) == P_LIMIT && number == 99);
    P_CHECK(planner_number("0",0,&number) == P_OK && number == 0);
    P_CHECK(planner_number("00017",9999,&number) == P_OK && number == 17);
    P_CHECK(planner_number(NULL,1,&number) == P_INVALID);
    P_CHECK(planner_number("0",-1,&number) == P_INVALID && planner_number("0",1,NULL) == P_INVALID);
    P_CHECK(load(&app,catalog,links) == P_OK);
    for (int i = 0; i < 32; i++) { P_CHECK(planner_find(&app,i,&row) == P_OK && row.minutes == i); }
    size_t max_baseline = p_live;
    unsigned char max_before[sizeof(app)]; memcpy(max_before,&app,sizeof(app));
    out = p_temp_file(); P_CHECK(out != NULL); start = p_attempts;
    P_CHECK(planner_export(out,&app) == P_OK);
    size_t max_export_allocations = p_attempts - start; P_CHECK(fclose(out) == 0);
    for (size_t i = 0; i < max_export_allocations; i++) {
        out = p_temp_file(); P_CHECK(out != NULL); p_fail_after((long)i);
        P_CHECK(planner_export(out,&app) == P_MEMORY); p_fail_after(-1);
        P_CHECK(ftell(out) == 0 && p_live == max_baseline && memcmp(max_before,&app,sizeof(app)) == 0);
        P_CHECK(fclose(out) == 0);
    }
    planner_clear(&app); planner_clear(&app);
    P_CHECK(p_live == 0 && p_open_streams == 0);
    printf("load_failure_positions=%zu export_failure_positions=%zu export_max_failure_positions=%zu view_failure_positions=1 io_cases=%zu live=0 streams=0\n",load_allocations,export_allocations,max_export_allocations,io_cases);
    return 0;
}
