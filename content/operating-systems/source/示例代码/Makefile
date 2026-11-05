CC = cc
CFLAGS = -std=c17 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Wpedantic -g
PROGRAMS = hello minutes control functions arrays pointers records copy syswrite process execute pipe-demo signal-demo scheduling threads mutex queue paging replacement mapping listdir socket-demo mini-shell
THREAD_PROGRAMS = threads mutex queue

.PHONY: all
all: $(PROGRAMS)

$(THREAD_PROGRAMS): %: %.c lab.h
	$(CC) $(CFLAGS) -pthread $< -o $@

$(filter-out $(THREAD_PROGRAMS),$(PROGRAMS)): %: %.c lab.h
	$(CC) $(CFLAGS) $< -o $@
