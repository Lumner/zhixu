#ifndef DSA_PLANNER_INTERNAL_H
#define DSA_PLANNER_INTERNAL_H
#include "planner.h"
PStatus p_relations(FILE *in, Planner *candidate);
PStatus p_catalog_status(CatStatus status);
PStatus p_graph_status(GStatus status);
size_t p_category(const Planner *app, int id);
size_t p_study(const Planner *app, int id);
size_t p_place(const Planner *app, int id);
#endif
