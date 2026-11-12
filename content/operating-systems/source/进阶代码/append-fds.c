#include <errno.h>
#include <fcntl.h>
#include <inttypes.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>

static int put_byte(int fd, unsigned char value) {
    ssize_t n;
    do { n = write(fd, &value, 1); } while (n < 0 && errno == EINTR);
    if (n < 0) { perror("write"); return -1; }
    if (n != 1) { fputs("write made no progress\n", stderr); return -1; }
    return 0;
}

static int positions(const char *step, int left, int right) {
    off_t a = lseek(left, 0, SEEK_CUR);
    if (a == (off_t)-1) { perror("left offset"); return -1; }
    off_t b = lseek(right, 0, SEEK_CUR);
    if (b == (off_t)-1) { perror("right offset"); return -1; }
    if (printf("%s left=%jd right=%jd\n", step, (intmax_t)a, (intmax_t)b) < 0) { return -1; }
    return 0;
}

int main(int argc, char **argv) {
    if (argc != 3 || (strcmp(argv[1], "plain") != 0 && strcmp(argv[1], "append") != 0)) {
        fputs("usage: append-fds plain|append NEW_FILE\n", stderr);
        return 2;
    }
    int left = -1, right = -1, result = 1;
    int extra = strcmp(argv[1], "append") == 0 ? O_APPEND : 0;
    left = open(argv[2], O_WRONLY | O_CREAT | O_EXCL | O_CLOEXEC | extra, 0600);
    if (left < 0) { perror("create new file"); goto done; }
    right = open(argv[2], O_WRONLY | O_NOFOLLOW | O_CLOEXEC | extra);
    if (right < 0) { perror("open second handle"); goto done; }
    if (put_byte(left, 'A') < 0 || positions("after-A", left, right) < 0) { goto done; }
    if (put_byte(right, 'B') < 0 || positions("after-B", left, right) < 0) { goto done; }
    if (put_byte(left, 'C') < 0 || positions("after-C", left, right) < 0) { goto done; }
    result = fflush(stdout) == EOF ? 1 : 0;
done:
    if (right >= 0 && close(right) < 0) { perror("close right"); result = 1; }
    if (left >= 0 && close(left) < 0) { perror("close left"); result = 1; }
    return result;
}
