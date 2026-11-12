#include "totals.h"
#include <assert.h>

int add_minutes(int a, int b)
{
    assert(a >= 0 && a <= 1440 && b >= 0 && b <= 1440);
    int result = a + b;
    return result;
}
