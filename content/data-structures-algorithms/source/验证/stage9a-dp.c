#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "coins.h"
#include "knapsack.h"
#define REQUIRE(test) do { if (!(test)) { fprintf(stderr,"DP oracle failed at %d\n",__LINE__); exit(1); } } while (0)
static void reference_change(const unsigned *coins, size_t n, unsigned *distance)
{
    unsigned queue[D_LIMIT + 1], head = 0, tail = 0;
    for (unsigned a = 0; a <= D_LIMIT; a++) { distance[a] = D_LIMIT + 1; }
    distance[0] = 0; queue[tail++] = 0;
    while (head < tail) {
        unsigned amount = queue[head++];
        for (size_t i = 0; i < n; i++) {
            unsigned next = amount + coins[i];
            if (next <= D_LIMIT && distance[next] == D_LIMIT + 1) {
                distance[next] = distance[amount] + 1; queue[tail++] = next;
            }
        }
    }
}
static void check_change(const unsigned *coins, size_t n, unsigned amount, const Change *change)
{
    unsigned total = 0, sum = 0;
    for (size_t i = 0; i < D_COINS; i++) {
        if (i < n) { sum += change->counts[i] * coins[i]; total += change->counts[i]; }
        else { REQUIRE(change->counts[i] == 0); }
    }
    if (change->possible) { REQUIRE(sum == amount && total == change->total); }
    else { REQUIRE(sum == 0 && total == 0 && change->total == 0); }
}
static void packs(const PackItem *items, size_t n, unsigned budget)
{
    PackItem before[D_ITEMS] = {{0}};
    if (n != 0) { memcpy(before, items, n * sizeof(*items)); }
    unsigned optimum = 0, best_mask = 0, best_cost = 0;
    for (unsigned mask = 0; mask < (1u << n); mask++) {
        unsigned cost = 0, value = 0;
        for (size_t i = 0; i < n; i++) {
            if (mask & (1u << i)) { cost += items[i].cost; value += items[i].value; }
        }
        if (cost <= budget && value > optimum) { optimum = value; best_mask = mask; best_cost = cost; }
    }
    PackResult result;
    unsigned rolling = 999;
    REQUIRE(pack01_table(items, n, budget, &result) == D_OK);
    REQUIRE(pack01_rolling(items, n, budget, &rolling) == D_OK);
    REQUIRE(result.value == optimum && result.mask == best_mask && result.cost == best_cost);
    REQUIRE(rolling == optimum);
    REQUIRE(n == 0 || memcmp(before, items, n * sizeof(*items)) == 0);
}
int main(void)
{
    unsigned long coin_cases = 0, pack_cases = 0, worse = 0, stuck_possible = 0;
    for (unsigned mask = 0; mask < 256; mask++) {
        unsigned coins[D_COINS] = {0}, distance[D_LIMIT + 1]; size_t n = 0;
        for (unsigned value = 8; value > 0; value--) {
            if (mask & (1u << (value - 1))) { coins[n++] = value; }
        }
        reference_change(coins, n, distance);
        unsigned before[D_COINS]; memcpy(before, coins, sizeof(before));
        for (unsigned amount = 0; amount <= D_LIMIT; amount++) {
            Change memo, table, greedy, old;
            memset(&greedy, 0x5a, sizeof(greedy)); memcpy(&old, &greedy, sizeof(old));
            REQUIRE(min_change_memo(coins, n, amount, &memo) == D_OK);
            REQUIRE(min_change_table(coins, n, amount, &table) == D_OK);
            int possible = distance[amount] != D_LIMIT + 1;
            REQUIRE(memo.possible == possible && table.possible == possible);
            if (possible) { REQUIRE(memo.total == distance[amount] && table.total == distance[amount]); }
            REQUIRE(memo.evaluations >= 1 && memo.evaluations <= amount + 1);
            REQUIRE(table.evaluations == amount + 1);
            check_change(coins,n,amount,&memo); check_change(coins,n,amount,&table);
            REQUIRE(memcmp(memo.counts, table.counts, sizeof(memo.counts)) == 0);
            DStatus status = greedy_change(coins,n,amount,&greedy);
            if (status == D_STUCK) {
                REQUIRE(memcmp(&greedy,&old,sizeof(greedy)) == 0);
                if (possible) { stuck_possible++; }
            } else {
                REQUIRE(status == D_OK && possible && greedy.possible);
                check_change(coins,n,amount,&greedy);
                REQUIRE(greedy.total >= distance[amount]);
                if (greedy.total > distance[amount]) { worse++; }
            }
            coin_cases++;
            REQUIRE(memcmp(before, coins, sizeof(before)) == 0);
        }
    }
    REQUIRE(worse != 0 && stuck_possible != 0);
    unsigned large[] = {20,19,18,17,16,15,14,13};
    Change a, b;
    REQUIRE(min_change_memo(large,8,60,&a) == D_OK && a.total == 3);
    REQUIRE(min_change_table(large,8,60,&b) == D_OK && b.total == 3);
    DStatus (*functions[])(const unsigned *,size_t,unsigned,Change *) = {greedy_change,min_change_memo,min_change_table};
    for (size_t f = 0; f < 3; f++) {
        Change result, old; memset(&result,0x5a,sizeof(result)); memcpy(&old,&result,sizeof(old));
        unsigned invalid[] = {4,4};
        REQUIRE(functions[f](invalid,2,6,&result) == D_INVALID);
        invalid[1] = 5; REQUIRE(functions[f](invalid,2,6,&result) == D_INVALID);
        invalid[1] = 0; REQUIRE(functions[f](invalid,2,6,&result) == D_RANGE);
        invalid[0] = 21; REQUIRE(functions[f](invalid,1,6,&result) == D_RANGE);
        REQUIRE(functions[f](large,9,0,&result) == D_RANGE);
        REQUIRE(functions[f](large,8,61,&result) == D_RANGE);
        REQUIRE(functions[f](NULL,1,0,&result) == D_INVALID);
        REQUIRE(functions[f](NULL,0,0,NULL) == D_INVALID);
        REQUIRE(memcmp(&result,&old,sizeof(result)) == 0);
    }
    PackItem items[D_ITEMS] = {{0}};
    unsigned long combinations = 1;
    for (size_t n = 0; n <= 4; n++) {
        for (unsigned long code = 0; code < combinations; code++) {
            unsigned long rest = code;
            for (size_t i = 0; i < n; i++) {
                unsigned digit = (unsigned)(rest % 16); rest /= 16;
                items[i] = (PackItem){digit / 4 + 1, digit % 4};
            }
            for (unsigned budget = 0; budget <= 8; budget++) { packs(items,n,budget); pack_cases++; }
        }
        combinations *= 16;
    }
    for (size_t i = 0; i < D_ITEMS; i++) { items[i] = (PackItem){1,100}; }
    packs(items,D_ITEMS,60); packs(NULL,0,60);
    items[0] = (PackItem){60,100}; packs(items,1,60);
    PackResult result, old;
    memset(&result,0x5a,sizeof(result)); memcpy(&old,&result,sizeof(old)); unsigned rolling = 999;
    items[0].cost = 0;
    REQUIRE(pack01_table(items,1,1,&result) == D_RANGE);
    REQUIRE(pack01_rolling(items,1,1,&rolling) == D_RANGE && rolling == 999);
    items[0].cost = 61; REQUIRE(pack01_table(items,1,1,&result) == D_RANGE);
    items[0] = (PackItem){1,101}; REQUIRE(pack01_table(items,1,1,&result) == D_RANGE);
    REQUIRE(pack01_table(items,9,1,&result) == D_RANGE);
    REQUIRE(pack01_table(items,1,61,&result) == D_RANGE);
    REQUIRE(pack01_table(NULL,1,1,&result) == D_INVALID);
    REQUIRE(pack01_table(NULL,0,0,NULL) == D_INVALID);
    REQUIRE(pack01_rolling(NULL,0,0,NULL) == D_INVALID);
    REQUIRE(memcmp(&result,&old,sizeof(result)) == 0);
    printf("coin_cases=%lu pack_cases=%lu greedy_counterexamples=1 boundaries=1\n",coin_cases,pack_cases);
    return 0;
}
