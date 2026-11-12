#include "sum.h"

int sum(const int *p, int n) {
    int total = 0;
    for (int i = 0; i < n; i = i + 1) {
        total = total + p[i];
    }
    return total;
}
