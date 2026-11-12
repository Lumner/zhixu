#ifndef DSA_PLANNER_H
#define DSA_PLANNER_H
#include "../stage6-catalog/io.h"
#include "../stage6-catalog/view.h"
#include "../45-topological/topological.h"
#include "../46-shortest/shortest.h"
#define P_CLASSES 8
#define P_LABEL 32
#define P_LINE 128
typedef enum {
    P_OK, P_INVALID, P_FORMAT, P_DUPLICATE, P_LIMIT,
    P_MISSING, P_CYCLE, P_MEMORY, P_IO
} PStatus;
typedef struct { int id, parent_id; char label[P_LABEL]; } PCategory;
typedef struct { int id; char label[P_LABEL]; } PPlace;
typedef struct {
    IndexedCatalog catalog;
    PCategory categories[P_CLASSES];
    size_t category_count, membership[RECORD_LIMIT];
    int study_ids[GRAPH_MAX];
    size_t study_count, place_count;
    PPlace places[GRAPH_MAX];
    Graph study, roads;
} Planner;
typedef struct { IRecord records[RECORD_LIMIT]; size_t count; SortStats stats; } PRecords;
typedef struct { int ids[GRAPH_MAX]; size_t count; } PIds;
typedef struct { size_t positions[P_CLASSES], depths[P_CLASSES], count; } PCategoryView;
typedef struct { int reachable; int ids[GRAPH_MAX]; size_t count; long cost; } PRoute;
void planner_init(Planner *app);
void planner_clear(Planner *app);
PStatus planner_number(const char *text, int limit, int *out);
PStatus planner_load(FILE *catalog, FILE *relations, Planner *out);
PStatus planner_load_files(const char *catalog, const char *relations, Planner *out);
PStatus planner_find(const Planner *app, int id, IRecord *out);
PStatus planner_view(const Planner *app, PRecords *out);
PStatus planner_title(const Planner *app, const char *pattern, PRecords *out);
PStatus planner_categories(const Planner *app, PCategoryView *out);
PStatus planner_order(const Planner *app, PIds *out);
PStatus planner_ready(const Planner *app, const int *done, size_t n, PIds *out);
PStatus planner_route(const Planner *app, int source, int target, PRoute *out);
PStatus planner_set_minutes(Planner *app, int id, int minutes);
PStatus planner_export(FILE *out, const Planner *app);
const char *planner_status_name(PStatus status);
#endif
