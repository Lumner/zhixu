#include "stage5-test.h"
#include "matching.h"
#include "chaining.h"
#include "open_map.h"
#include "catalog.h"
#include <string.h>

static unsigned long state = 20261111;
static unsigned int random_word(void)
{
    state = (state * 1664525UL + 1013904223UL) % 4294967296UL;
    return (unsigned int)(state / 65536UL);
}
static void binary_word(char *text, size_t n, unsigned int code)
{
    for (size_t i = 0; i < n; i++) { text[i] = code % 2 ? 'b' : 'a'; code /= 2; }
    text[n] = '\0';
}
static size_t matching_cases(void)
{
    size_t cases = 0;
    for (size_t m = 0; m <= 5; m++) {
        for (unsigned int p = 0; p < (1U << m); p++) {
            char pattern[6];
            size_t pi[MATCH_PATTERN_MAX];
            binary_word(pattern, m, p);
            REQUIRE(prefix_build(pattern, m, pi, MATCH_PATTERN_MAX) == M_OK, "prefix status");
            for (size_t i = 0; i < m; i++) {
                size_t expected = 0;
                for (size_t length = 1; length <= i; length++) {
                    if (memcmp(pattern, pattern + i + 1 - length, length) == 0) { expected = length; }
                }
                REQUIRE(pi[i] == expected, "prefix brute oracle");
            }
            for (size_t n = 0; n <= 8; n++) {
                for (unsigned int t = 0; t < (1U << n); t++) {
                    char text[9];
                    binary_word(text, n, t);
                    const char *reference = strstr(text, pattern);
                    Match a = {-1, 999}, b = {-1, 999};
                    REQUIRE(naive_match(text, n, pattern, m, &a) == M_OK, "naive status");
                    REQUIRE(kmp_match(text, n, pattern, m, &b) == M_OK, "kmp status");
                    size_t expected = reference == NULL ? n : (size_t)(reference - text);
                    REQUIRE(a.found == (reference != NULL) && a.index == expected, "naive library oracle");
                    REQUIRE(b.found == a.found && b.index == a.index, "kmp library oracle");
                    cases++;
                }
            }
        }
    }
    char text[MATCH_TEXT_MAX + 1], pattern[MATCH_PATTERN_MAX + 1];
    memset(text, 'a', sizeof text); memset(pattern, 'a', sizeof pattern);
    text[255] = 'b'; pattern[63] = 'b';
    Match out;
    REQUIRE(kmp_match(text, 256, pattern, 64, &out) == M_OK && out.found && out.index == 192, "maximum last match");
    pattern[63] = 'c';
    REQUIRE(kmp_match(text, 256, pattern, 64, &out) == M_OK && !out.found && out.index == 256, "maximum absent");
    out.found = 7; out.index = 999;
    REQUIRE(kmp_match(text, 257, pattern, 64, &out) == M_LENGTH && out.found == 7 && out.index == 999, "length preserves output");
    REQUIRE(naive_match(text, 256, pattern, 65, &out) == M_LENGTH && out.index == 999, "pattern length");
    REQUIRE(kmp_match(NULL, 1, pattern, 1, &out) == M_INVALID && out.index == 999, "null nonempty text");
    REQUIRE(kmp_match(text, 1, NULL, 1, &out) == M_INVALID, "null nonempty pattern");
    REQUIRE(kmp_match(NULL, 0, NULL, 0, &out) == M_OK && out.found && out.index == 0, "null empty buffers");
    REQUIRE(naive_match(NULL, 0, pattern, 1, &out) == M_OK && !out.found && out.index == 0, "empty absent");
    REQUIRE(kmp_match(text, 1, pattern, 1, NULL) == M_INVALID, "null match output");
    size_t pi[64]; pi[0] = 999;
    REQUIRE(prefix_build(pattern, 64, pi, 63) == M_LENGTH && pi[0] == 999, "prefix capacity preserves");
    REQUIRE(prefix_build(NULL, 1, pi, 64) == M_INVALID, "prefix null");
    REQUIRE(prefix_build(NULL, 0, NULL, 0) == M_OK, "prefix empty");
    const char bytes[] = {'x', '\0', 'a', '\0', 'b'};
    const char needle[] = {'\0', 'b'};
    REQUIRE(kmp_match(bytes, 5, needle, 2, &out) == M_OK && out.found && out.index == 3, "embedded zero bytes");
    const char utf8[] = "\xe4\xb8\xad" "A" "\xe6\x96\x87";
    REQUIRE(kmp_match(utf8, 7, utf8 + 4, 3, &out) == M_OK && out.found && out.index == 4, "UTF8 byte offset");
    return cases;
}
static void map_invariants(const ChainMap *chain, const OpenMap *open, size_t expected)
{
    size_t nodes = 0, live = 0, used = 0;
    REQUIRE(chain->count == expected && open->count == expected, "map count");
    for (size_t b = 0; b < CHAIN_BUCKETS; b++) {
        for (const HNode *p = chain->buckets[b]; p != NULL; p = p->next) {
            REQUIRE(++nodes <= H_MAX_ITEMS, "chain acyclic budget");
            REQUIRE((size_t)p->key % CHAIN_BUCKETS == b, "chain bucket");
        }
    }
    REQUIRE(nodes == expected, "chain node count");
    REQUIRE(open->capacity == 0 || open->capacity == 8 || open->capacity == 16 || open->capacity == 32 || open->capacity == 64, "capacity set");
    for (size_t i = 0; i < open->capacity; i++) {
        const HSlot *s = &open->slots[i];
        REQUIRE(s->state == SLOT_EMPTY || s->state == SLOT_LIVE || s->state == SLOT_DELETED, "slot enum");
        if (s->state != SLOT_EMPTY) { used++; }
        if (s->state == SLOT_LIVE) {
            int value;
            REQUIRE(open_get(open, s->key, &value) == H_OK && value == s->value, "live slot reachable");
            live++;
        }
    }
    REQUIRE(live == expected && used == open->used && live <= used, "slot counts");
    REQUIRE(used <= open->capacity * 3 / 4, "occupied budget");
}
static void map_histories(void)
{
    ChainMap chain; OpenMap open;
    chain_init(&chain); open_init(&open);
    int present[128] = {0}, values[128] = {0}; size_t count = 0;
    for (size_t step = 0; step < 30000; step++) {
        size_t k = random_word() % 128;
        int key = (int)k * 64, value = (int)random_word() - 30000;
        unsigned int action = random_word() % 4;
        HStatus expected, a, b;
        if (action == 0) {
            expected = present[k] ? H_DUPLICATE : count == H_MAX_ITEMS ? H_FULL : H_OK;
            a = chain_put(&chain, key, value); b = open_put(&open, key, value);
            if (expected == H_OK) { present[k] = 1; values[k] = value; count++; }
        }
        else if (action == 1) {
            expected = present[k] ? H_OK : H_MISSING;
            a = chain_set(&chain, key, value); b = open_set(&open, key, value);
            if (expected == H_OK) { values[k] = value; }
        }
        else if (action == 2) {
            expected = present[k] ? H_OK : H_MISSING;
            a = chain_erase(&chain, key); b = open_erase(&open, key);
            if (expected == H_OK) { present[k] = 0; count--; }
        }
        else {
            int x = -777, y = -777;
            expected = present[k] ? H_OK : H_MISSING;
            a = chain_get(&chain, key, &x); b = open_get(&open, key, &y);
            REQUIRE(x == (present[k] ? values[k] : -777) && x == y, "get copied value");
        }
        REQUIRE(a == expected && b == expected, "model operation status");
        map_invariants(&chain, &open, count);
        if (step % 17 == 0) {
            for (size_t j = 0; j < 128; j++) {
                int x = -777, y = -777;
                HStatus status = present[j] ? H_OK : H_MISSING;
                REQUIRE(chain_get(&chain, (int)j * 64, &x) == status && open_get(&open, (int)j * 64, &y) == status, "all model keys");
                REQUIRE(x == (present[j] ? values[j] : -777) && x == y, "all model values");
            }
        }
    }
    int value = 999;
    REQUIRE(chain_get(&chain, -1, &value) == H_INVALID && value == 999, "chain invalid output");
    REQUIRE(open_get(&open, 10000, &value) == H_INVALID && value == 999, "open invalid output");
    REQUIRE(chain_get(&chain, 0, NULL) == H_INVALID && open_get(&open, 0, NULL) == H_INVALID, "null get output");
    REQUIRE(chain_put(&chain, -1, 0) == H_INVALID && open_put(&open, -1, 0) == H_INVALID, "negative insert");
    REQUIRE(chain_set(&chain, 10000, 0) == H_INVALID && open_set(&open, 10000, 0) == H_INVALID, "invalid set");
    REQUIRE(chain_erase(&chain, -1) == H_INVALID && open_erase(&open, -1) == H_INVALID, "invalid erase");
    REQUIRE(open_rehash(&open, 7) == H_INVALID, "invalid rehash capacity");
    chain_clear(&chain); open_clear(&open);
    for (int i = 0; i < H_MAX_ITEMS; i++) {
        REQUIRE(chain_put(&chain, i, i) == H_OK && open_put(&open, i, i) == H_OK, "fill max");
        size_t expected_capacity = i < 6 ? 8 : i < 12 ? 16 : i < 24 ? 32 : 64;
        REQUIRE(open.capacity == expected_capacity, "growth boundary");
    }
    REQUIRE(chain_put(&chain, 0, 999) == H_DUPLICATE && open_put(&open, 0, 999) == H_DUPLICATE, "full duplicate first");
    REQUIRE(chain_put(&chain, 9999, 0) == H_FULL && open_put(&open, 9999, 0) == H_FULL, "item budget full");
    REQUIRE(open_rehash(&open, 32) == H_INVALID, "rehash too small");
    for (int i = 0; i < H_MAX_ITEMS; i++) {
        REQUIRE(chain_erase(&chain, i) == H_OK && open_erase(&open, i) == H_OK, "drain all");
    }
    REQUIRE(open.count == 0 && open.used != 0, "tombstones after drain");
    REQUIRE(open_rehash(&open, 8) == H_OK && open.used == 0, "shrink clears tombstones");
    chain_clear(&chain); open_clear(&open);
    REQUIRE(s5_live == 0, "maps release all");
}
static IRecord record(int id, int minutes)
{
    IRecord r = {0}; r.id = id; r.minutes = minutes;
    (void)snprintf(r.title, sizeof r.title, "lesson-%d", id);
    return r;
}
static int same_record(const IRecord *a, const IRecord *b)
{
    return a->id == b->id && a->minutes == b->minutes && strcmp(a->title, b->title) == 0;
}
static void catalog_invariants(const IndexedCatalog *c, const IRecord *model, size_t n)
{
    REQUIRE(c->count == n && c->index.count == n, "catalog count");
    for (size_t i = 0; i < n; i++) {
        IRecord out; int position = -1;
        REQUIRE(same_record(&c->records[i], &model[i]), "catalog order contents");
        REQUIRE(indexed_find(c, model[i].id, &out) == H_OK && same_record(&out, &model[i]), "catalog copied query");
        REQUIRE(open_get(&c->index, model[i].id, &position) == H_OK && position == (int)i, "catalog id position");
    }
    size_t live = 0;
    for (size_t i = 0; i < c->index.capacity; i++) {
        const HSlot *s = &c->index.slots[i];
        if (s->state == SLOT_LIVE) {
            REQUIRE(s->value >= 0 && (size_t)s->value < n && c->records[s->value].id == s->key, "index reverse relation");
            live++;
        }
    }
    REQUIRE(live == n, "index no extras");
}
static void catalog_histories(void)
{
    IndexedCatalog c; indexed_init(&c);
    IRecord model[H_MAX_ITEMS]; size_t n = 0;
    for (size_t step = 0; step < 4000; step++) {
        int id = (int)(random_word() % 64) * 64;
        int minutes = (int)(random_word() % 1441);
        size_t pos = 0;
        while (pos < n && model[pos].id != id) { pos++; }
        HStatus expected, actual;
        switch (random_word() % 3) {
        case 0: {
            IRecord item = record(id, minutes);
            expected = pos != n ? H_DUPLICATE : n == H_MAX_ITEMS ? H_FULL : H_OK;
            actual = indexed_add(&c, &item);
            if (expected == H_OK) { model[n++] = item; }
            break;
        }
        case 1:
            expected = pos == n ? H_MISSING : H_OK;
            actual = indexed_remove(&c, id);
            if (expected == H_OK) { memmove(model + pos, model + pos + 1, (n - pos - 1) * sizeof *model); n--; }
            break;
        default:
            expected = pos == n ? H_MISSING : H_OK;
            actual = indexed_set_minutes(&c, id, minutes);
            if (expected == H_OK) { model[pos].minutes = minutes; }
            break;
        }
        REQUIRE(actual == expected, "catalog model status");
        catalog_invariants(&c, model, n);
    }
    IRecord out = record(9999, 123), saved = out;
    REQUIRE(indexed_find(&c, 9999, &out) == H_MISSING && same_record(&out, &saved), "catalog missing preserves");
    REQUIRE(indexed_find(&c, 0, NULL) == H_INVALID, "catalog null output");
    REQUIRE(indexed_add(&c, NULL) == H_INVALID, "catalog null record");
    REQUIRE(indexed_set_minutes(&c, 0, 1441) == H_INVALID, "catalog invalid minutes");
    REQUIRE(indexed_replace(&c, NULL, 1) == H_INVALID, "catalog null list");
    REQUIRE(indexed_replace(&c, model, 49) == H_INVALID, "catalog oversized");
    catalog_invariants(&c, model, n);
    IRecord bad = record(1, 0);
    memset(bad.title, 'a', sizeof bad.title);
    REQUIRE(indexed_replace(&c, &bad, 1) == H_INVALID, "title not terminated");
    bad = record(1, 0); bad.title[0] = '\0';
    REQUIRE(indexed_add(&c, &bad) == H_INVALID, "title empty");
    bad = record(1, 0); bad.title[0] = '\n';
    REQUIRE(indexed_add(&c, &bad) == H_INVALID, "title control");
    bad = record(1, 0); memset(bad.title, 'a', 63); bad.title[63] = '\0';
    REQUIRE(indexed_replace(&c, &bad, 1) == H_OK, "title 63 bytes");
    REQUIRE(indexed_replace(&c, NULL, 0) == H_OK && c.count == 0 && c.index.capacity == 0, "empty replacement");
    indexed_clear(&c); indexed_clear(&c);
    REQUIRE(s5_live == 0, "catalog releases all");
}
static size_t failures(void)
{
    size_t cases = 0;
    ChainMap chain; chain_init(&chain);
    REQUIRE(chain_put(&chain, 1, 10) == H_OK, "failure chain base");
    HNode *old_head = chain.buckets[1];
    s5_fail_after(0);
    REQUIRE(chain_put(&chain, 9, 90) == H_MEMORY && chain.buckets[1] == old_head && chain.count == 1, "chain failure preserves");
    cases++; s5_fail_after(-1); chain_clear(&chain);
    OpenMap open; open_init(&open);
    s5_fail_after(0);
    REQUIRE(open_put(&open, 0, 10) == H_MEMORY && open.slots == NULL && open.count == 0, "first allocation fails");
    cases++; s5_fail_after(-1);
    for (int i = 0; i < 6; i++) { REQUIRE(open_put(&open, i, i * 10) == H_OK, "fill six"); }
    HSlot *slots = open.slots;
    s5_fail_after(0);
    REQUIRE(open_put(&open, 6, 60) == H_MEMORY && open.slots == slots && open.capacity == 8 && open.count == 6 && open.used == 6, "growth failure preserves");
    cases++; s5_fail_after(-1);
    for (int i = 0; i < 5; i++) { REQUIRE(open_erase(&open, i) == H_OK, "create tombstones"); }
    s5_fail_after(0);
    REQUIRE(open_put(&open, 6, 60) == H_MEMORY && open.slots == slots && open.count == 1 && open.used == 6, "cleanup failure preserves");
    cases++; s5_fail_after(-1);
    REQUIRE(open_put(&open, 6, 60) == H_OK && open.capacity == 8 && open.count == 2 && open.used == 2, "same size cleanup");
    slots = open.slots;
    s5_fail_after(0);
    REQUIRE(open_rehash(&open, 16) == H_MEMORY && open.slots == slots && open.count == 2, "explicit rehash failure");
    cases++; s5_fail_after(-1);
    int value;
    REQUIRE(open_get(&open, 5, &value) == H_OK && value == 50 && open_get(&open, 6, &value) == H_OK && value == 60, "failed operations retain values");
    open_clear(&open);
    IRecord base[] = {{1, 10, "old"}, {9, 20, "second"}};
    IRecord incoming[H_MAX_ITEMS];
    for (int i = 0; i < H_MAX_ITEMS; i++) { incoming[i] = record(i * 64, i); }
    IndexedCatalog c; indexed_init(&c);
    REQUIRE(indexed_replace(&c, base, 2) == H_OK, "catalog failure base");
    for (long fail = 0; fail < 4; fail++) {
        slots = c.index.slots; size_t live = s5_live;
        s5_fail_after(fail);
        REQUIRE(indexed_replace(&c, incoming, H_MAX_ITEMS) == H_MEMORY, "replacement allocation fail");
        s5_fail_after(-1);
        REQUIRE(c.index.slots == slots && s5_live == live, "failed candidate cleaned");
        catalog_invariants(&c, base, 2); cases++;
    }
    incoming[47].id = incoming[0].id;
    REQUIRE(indexed_replace(&c, incoming, 48) == H_DUPLICATE, "late duplicate");
    catalog_invariants(&c, base, 2);
    incoming[47] = record(47 * 64, 47); incoming[47].minutes = -1;
    REQUIRE(indexed_replace(&c, incoming, 48) == H_INVALID, "late invalid");
    catalog_invariants(&c, base, 2);
    incoming[47].minutes = 47;
    REQUIRE(indexed_replace(&c, incoming, 48) == H_OK, "large replacement");
    for (long fail = 0; fail < 4; fail++) {
        slots = c.index.slots; size_t live = s5_live;
        s5_fail_after(fail);
        REQUIRE(indexed_remove(&c, incoming[0].id) == H_MEMORY, "delete rebuild failure");
        s5_fail_after(-1);
        REQUIRE(c.index.slots == slots && s5_live == live, "delete old owner retained");
        catalog_invariants(&c, incoming, 48); cases++;
    }
    REQUIRE(indexed_replace(&c, incoming, 6) == H_OK, "six for add failure");
    for (long fail = 0; fail < 2; fail++) {
        s5_fail_after(fail);
        REQUIRE(indexed_add(&c, &incoming[6]) == H_MEMORY, "add rebuild failure");
        s5_fail_after(-1); catalog_invariants(&c, incoming, 6); cases++;
    }
    REQUIRE(indexed_replace(&c, incoming, 1) == H_OK, "one for empty delete");
    s5_fail_after(0);
    REQUIRE(indexed_remove(&c, incoming[0].id) == H_OK && c.count == 0, "last delete needs no allocation");
    s5_fail_after(-1); indexed_clear(&c);
    REQUIRE(s5_live == 0, "failure paths release all");
    return cases;
}
int main(void)
{
    size_t words = matching_cases();
    map_histories(); catalog_histories(); size_t failed = failures();
    printf("matching_pairs=%zu map_steps=30000 catalog_steps=4000 allocation_failures=%zu live=%zu\n", words, failed, s5_live);
    return 0;
}
