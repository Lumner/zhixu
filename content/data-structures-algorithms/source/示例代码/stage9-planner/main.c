#include "planner.h"
#include <string.h>
static void record_print(const IRecord *row)
{
    printf("id=%d minutes=%d title=%s\n", row->id, row->minutes, row->title);
}
static void ids_print(const char *name, const PIds *ids)
{
    printf("%s=", name);
    if (ids->count == 0) { fputs("empty", stdout); }
    for (size_t i = 0; i < ids->count; i++) { printf("%s%d", i == 0 ? "" : ",", ids->ids[i]); }
    puts("");
}
static int valid_command(int argc, char **argv)
{
    if (argc < 4) { return 0; }
    const char *command = argv[3];
    if (!strcmp(command,"check") || !strcmp(command,"list") || !strcmp(command,"categories") ||
        !strcmp(command,"order") || !strcmp(command,"export")) { return argc == 4; }
    if (!strcmp(command,"find") || !strcmp(command,"title")) { return argc == 5; }
    if (!strcmp(command,"route") || !strcmp(command,"minutes")) { return argc == 6; }
    if (!strcmp(command,"ready")) { return argc <= 4 + GRAPH_MAX; }
    return 0;
}
static PStatus execute(Planner *app, int argc, char **argv)
{
    const char *command = argv[3];
    if (!strcmp(command,"check")) {
        printf("records=%zu categories=%zu study=%zu places=%zu\n", app->catalog.count,
               app->category_count, app->study_count, app->place_count);
        return P_OK;
    }
    if (!strcmp(command,"export")) { return planner_export(stdout,app); }
    if (!strcmp(command,"find") || !strcmp(command,"minutes") || !strcmp(command,"route")) {
        int first, second;
        PStatus status = planner_number(argv[4],9999,&first);
        if (status != P_OK) { return status; }
        if (!strcmp(command,"find")) {
            IRecord row;
            status = planner_find(app,first,&row);
            if (status == P_OK) { record_print(&row); }
            return status;
        }
        status = planner_number(argv[5],!strcmp(command,"minutes") ? 1440 : 9999,&second);
        if (status != P_OK) { return status; }
        if (!strcmp(command,"minutes")) {
            status = planner_set_minutes(app,first,second);
            return status == P_OK ? planner_export(stdout,app) : status;
        }
        PRoute route;
        status = planner_route(app,first,second,&route);
        if (status != P_OK) { return status; }
        if (!route.reachable) { puts("unreachable"); return P_OK; }
        printf("cost=%ld path=",route.cost);
        for (size_t i = 0; i < route.count; i++) { printf("%s%d",i == 0 ? "" : ",",route.ids[i]); }
        puts(""); return P_OK;
    }
    if (!strcmp(command,"list") || !strcmp(command,"title")) {
        PRecords rows;
        PStatus status = !strcmp(command,"list") ? planner_view(app,&rows) : planner_title(app,argv[4],&rows);
        if (status != P_OK) { return status; }
        if (rows.count == 0) { puts("no matches"); }
        for (size_t i = 0; i < rows.count; i++) { record_print(&rows.records[i]); }
        return P_OK;
    }
    if (!strcmp(command,"categories")) {
        PCategoryView view;
        PStatus status = planner_categories(app,&view);
        if (status != P_OK) { return status; }
        if (view.count == 0) { puts("empty categories"); }
        for (size_t i = 0; i < view.count; i++) {
            size_t category = view.positions[i];
            for (size_t d = 0; d < view.depths[i]; d++) { fputs("  ",stdout); }
            printf("category=%d label=%s\n",app->categories[category].id,app->categories[category].label);
            for (size_t j = 0; j < app->catalog.count; j++) {
                if (app->membership[j] == category) {
                    for (size_t d = 0; d <= view.depths[i]; d++) { fputs("  ",stdout); }
                    record_print(&app->catalog.records[j]);
                }
            }
        }
        return P_OK;
    }
    PIds ids;
    PStatus status;
    if (!strcmp(command,"order")) {
        status = planner_order(app,&ids);
    } else {
        int done[GRAPH_MAX]; size_t n = (size_t)(argc - 4);
        for (size_t i = 0; i < n; i++) {
            status = planner_number(argv[i + 4],9999,&done[i]);
            if (status != P_OK) { return status; }
        }
        status = planner_ready(app,done,n,&ids);
    }
    if (status == P_OK) { ids_print(command,&ids); }
    return status;
}
int main(int argc, char **argv)
{
    if (!valid_command(argc,argv)) {
        fputs("usage: planner catalog relations check|list|find ID|title PATTERN|categories|order|ready [ID...]|route FROM TO|minutes ID VALUE|export\n",stderr);
        return 1;
    }
    Planner app;
    planner_init(&app);
    PStatus status = planner_load_files(argv[1],argv[2],&app);
    if (status == P_OK) { status = execute(&app,argc,argv); }
    if (status == P_OK && (fflush(stdout) != 0 || ferror(stdout))) { status = P_IO; }
    planner_clear(&app);
    if (status != P_OK) { fprintf(stderr,"planner: %s\n",planner_status_name(status)); }
    return status == P_OK ? 0 : 1;
}
