#include "stage4-test.h"
#include "sequence.h"
#include "vector.h"
#include "singly.h"
#include "doubly.h"
#include "stack.h"
#include "queue.h"
#include <stdint.h>
#include <stdio.h>
#include <string.h>

typedef struct { Sequence seq; Vector vec; SList single; DList dual; } Lists;
static uint32_t seed = 20261111u;
static uint32_t random_value(void) { seed = seed * 1664525u + 1013904223u; return seed; }
static void lists_init(Lists *a) { seq_init(&a->seq); vec_init(&a->vec); slist_init(&a->single); dlist_init(&a->dual); }
static void lists_clear(Lists *a) { seq_init(&a->seq); vec_clear(&a->vec); slist_clear(&a->single); dlist_clear(&a->dual); }
static DsStatus insert(Lists *a, int k, size_t p, int v)
{
    switch(k) { case 0:return seq_insert(&a->seq,p,v); case 1:return vec_insert(&a->vec,p,v); case 2:return slist_insert(&a->single,p,v); default:return dlist_insert(&a->dual,p,v); }
}
static DsStatus erase(Lists *a, int k, size_t p, int *out)
{
    switch(k) { case 0:return seq_erase(&a->seq,p,out); case 1:return vec_erase(&a->vec,p,out); case 2:return slist_erase(&a->single,p,out); default:return dlist_erase(&a->dual,p,out); }
}
static DsStatus get(const Lists *a, int k, size_t p, int *out)
{
    switch(k) { case 0:return seq_get(&a->seq,p,out); case 1:return vec_get(&a->vec,p,out); case 2:return slist_get(&a->single,p,out); default:return dlist_get(&a->dual,p,out); }
}
static DsStatus set(Lists *a, int k, size_t p, int v)
{
    switch(k) { case 0:return seq_set(&a->seq,p,v); case 1:return vec_set(&a->vec,p,v); case 2:return slist_set(&a->single,p,v); default:return dlist_set(&a->dual,p,v); }
}
static void verify_list(const Lists *a, int k, const int *model, size_t n)
{
    size_t count = k==0 ? a->seq.count : k==1 ? a->vec.count : k==2 ? a->single.count : a->dual.count;
    s4_need(count==n, "list count");
    if (k==0) s4_need(n<=SEQ_CAPACITY, "sequence capacity");
    if (k==1) {
        s4_need(n<=a->vec.capacity && a->vec.capacity<=DS_MAX_ITEMS, "vector capacity");
        s4_need(a->vec.capacity==0 ? a->vec.data==NULL : s4_owned(a->vec.data), "vector ownership");
    }
    if (k==2) {
        const SNode *node=a->single.head.next;
        for(size_t i=0;i<n;i++) { s4_need(s4_owned(node),"singly live node"); s4_need(node->value==model[i],"singly order"); node=node->next; }
        s4_need(node==NULL,"singly termination");
    }
    if (k==3) {
        const DNode *root=&a->dual.root, *node=root->next, *previous=root;
        for(size_t i=0;i<n;i++) { s4_need(s4_owned(node),"doubly live node"); s4_need(node->previous==previous && previous->next==node,"doubly forward links"); s4_need(node->value==model[i],"doubly order"); previous=node; node=node->next; }
        s4_need(node==root && root->previous==previous,"doubly forward sentinel");
        node=root->previous; const DNode *next=root;
        for(size_t i=n;i>0;i--) { s4_need(s4_owned(node),"doubly reverse live node"); s4_need(node->next==next && next->previous==node,"doubly reverse links"); s4_need(node->value==model[i-1],"doubly reverse order"); next=node; node=node->previous; }
        s4_need(node==root && root->next==next,"doubly reverse sentinel");
    }
    for(size_t i=0;i<n;i++) { int value=777; s4_need(get(a,k,i,&value)==DS_OK && value==model[i],"list value"); }
}

static void list_models(void)
{
    for(int k=0;k<4;k++) {
        Lists a; lists_init(&a); int model[DS_MAX_ITEMS+1]={0}; size_t n=0;
        size_t capacity=k==0?SEQ_CAPACITY:DS_MAX_ITEMS;
        for(size_t step=0;step<5000;step++) {
            unsigned int op=random_value()%6; size_t p=random_value()%(n+2); int value=(int)(random_value()%201)-100;
            int out=777, expected_out=777; DsStatus expected=DS_OK, actual;
            if(op<=1) {
                if(p>n) expected=DS_RANGE; else if(n==capacity) expected=DS_FULL;
                actual=insert(&a,k,p,value);
                if(expected==DS_OK) { memmove(model+p+1,model+p,(n-p)*sizeof *model); model[p]=value; n++; }
            } else if(op==2) {
                if(p>=n) expected=DS_RANGE;
                actual=erase(&a,k,p,&out);
                if(expected==DS_OK) { expected_out=model[p]; memmove(model+p,model+p+1,(n-p-1)*sizeof *model); n--; }
            } else if(op==3) {
                if(p>=n) expected=DS_RANGE;
                actual=set(&a,k,p,value); if(expected==DS_OK) model[p]=value;
            } else if(op==4) {
                if(p>=n) expected=DS_RANGE;
                actual=get(&a,k,p,&out); if(expected==DS_OK) expected_out=model[p];
            } else { lists_clear(&a); n=0; actual=DS_OK; }
            s4_need(actual==expected,"list status"); s4_need(out==expected_out,"list output preservation"); verify_list(&a,k,model,n);
        }
        lists_clear(&a); n=0;
        for(size_t i=0;i<capacity;i++) { s4_need(insert(&a,k,n,(int)i)==DS_OK,"fill list"); model[n++]=(int)i; verify_list(&a,k,model,n); }
        s4_fail_at(1);
        s4_need(insert(&a,k,0,99)==DS_FULL && s4_requests()==0,"full list rejects before allocation");
        s4_need(insert(&a,k,n+1,99)==DS_RANGE,"range before full");
        s4_fail_at(0);
        s4_need(get(&a,k,0,NULL)==DS_INVALID && erase(&a,k,0,NULL)==DS_INVALID,"null list output");
        s4_need(insert(&a,k,(size_t)-1,0)==DS_RANGE,"huge insertion index");
        while(n>0) { size_t p=n/2; int out=777, expected=model[p]; s4_need(erase(&a,k,p,&out)==DS_OK && out==expected,"drain list"); memmove(model+p,model+p+1,(n-p-1)*sizeof *model); n--; verify_list(&a,k,model,n); }
        lists_clear(&a); lists_clear(&a); s4_need(s4_live()==0,"list cleanup balance");
    }
}

typedef struct { ArrayStack array; LinkedStack linked; Queue ring; LinkedQueue fifo; } Ends;
static void ends_init(Ends *a,size_t capacity) { stack_init(&a->array); lstack_init(&a->linked); s4_need(queue_init(&a->ring,capacity)==DS_OK,"queue init"); lqueue_init(&a->fifo); }
static void ends_clear(Ends *a,size_t capacity) { stack_init(&a->array); lstack_clear(&a->linked); s4_need(queue_init(&a->ring,capacity)==DS_OK,"queue reset"); lqueue_clear(&a->fifo); }
static DsStatus push(Ends *a,int k,int value) { switch(k) { case 0:return stack_push(&a->array,value); case 1:return lstack_push(&a->linked,value); case 2:return queue_push(&a->ring,value); default:return lqueue_push(&a->fifo,value); } }
static DsStatus pop(Ends *a,int k,int *out) { switch(k) { case 0:return stack_pop(&a->array,out); case 1:return lstack_pop(&a->linked,out); case 2:return queue_pop(&a->ring,out); default:return lqueue_pop(&a->fifo,out); } }
static DsStatus peek(const Ends *a,int k,int *out) { switch(k) { case 0:return stack_peek(&a->array,out); case 1:return lstack_peek(&a->linked,out); case 2:return queue_peek(&a->ring,out); default:return lqueue_peek(&a->fifo,out); } }
static void verify_ends(const Ends *a,int k,const int *model,size_t n)
{
    size_t count=k==0?a->array.count:k==1?a->linked.count:k==2?a->ring.count:a->fifo.count;
    s4_need(count==n,"end structure count");
    if(k==0) for(size_t i=0;i<n;i++) s4_need(a->array.data[i]==model[i],"array stack order");
    if(k==1) { const StackNode *node=a->linked.top; for(size_t i=n;i>0;i--) { s4_need(s4_owned(node),"linked stack live node"); s4_need(node->value==model[i-1],"linked stack order"); node=node->next; } s4_need(node==NULL,"linked stack termination"); }
    if(k==2) { s4_need(a->ring.capacity>=1 && a->ring.capacity<=16 && a->ring.head<a->ring.capacity && n<=a->ring.capacity,"ring bounds"); for(size_t i=0;i<n;i++) s4_need(a->ring.data[(a->ring.head+i)%a->ring.capacity]==model[i],"ring logical order"); }
    if(k==3) { const QNode *node=a->fifo.head,*last=NULL; for(size_t i=0;i<n;i++) { s4_need(s4_owned(node),"linked queue live node"); s4_need(node->value==model[i],"linked queue order"); last=node; node=node->next; } s4_need(node==NULL && last==a->fifo.tail,"linked queue tail"); if(n==0) s4_need(a->fifo.head==NULL && a->fifo.tail==NULL,"linked queue empty ends"); }
}
static void end_models(void)
{
    for(int k=0;k<4;k++) for(size_t c=1;c<=(k==2?16u:1u);c++) {
        Ends a; ends_init(&a,c); int model[DS_MAX_ITEMS+1]={0}; size_t n=0;
        size_t capacity=k==0?STACK_CAPACITY:k==2?c:DS_MAX_ITEMS;
        for(size_t step=0;step<3000;step++) {
            unsigned int op=random_value()%20; int value=(int)(random_value()%201)-100, out=777, expected_out=777; DsStatus expected=DS_OK, actual;
            if(op<8) { if(n==capacity) expected=DS_FULL; actual=push(&a,k,value); if(expected==DS_OK) model[n++]=value; }
            else if(op<16) { if(n==0) expected=DS_EMPTY; actual=pop(&a,k,&out); if(expected==DS_OK) { size_t p=k<2?n-1:0; expected_out=model[p]; memmove(model+p,model+p+1,(n-p-1)*sizeof *model); n--; } }
            else if(op<19) { if(n==0) expected=DS_EMPTY; actual=peek(&a,k,&out); if(expected==DS_OK) expected_out=model[k<2?n-1:0]; }
            else { ends_clear(&a,c); n=0; actual=DS_OK; }
            s4_need(actual==expected && out==expected_out,"end status and output"); verify_ends(&a,k,model,n);
        }
        ends_clear(&a,c); n=0;
        for(size_t i=0;i<capacity;i++) { s4_need(push(&a,k,(int)i)==DS_OK,"fill end structure"); model[n++]=(int)i; }
        s4_fail_at(1); s4_need(push(&a,k,99)==DS_FULL && s4_requests()==0,"full end structure"); s4_fail_at(0);
        s4_need(pop(&a,k,NULL)==DS_INVALID && peek(&a,k,NULL)==DS_INVALID,"null end output");
        while(n>0) { int out=777; size_t p=k<2?n-1:0; s4_need(pop(&a,k,&out)==DS_OK && out==model[p],"drain end structure"); memmove(model+p,model+p+1,(n-p-1)*sizeof *model); n--; verify_ends(&a,k,model,n); }
        int out=777; s4_need(pop(&a,k,&out)==DS_EMPTY && out==777,"empty preserves output");
        ends_clear(&a,c); ends_clear(&a,c); s4_need(s4_live()==0,"end cleanup balance");
    }
}

static void failures(void)
{
    for(int k=1;k<4;k++) {
        Lists a; lists_init(&a); int model[65]={10,20,30,40}; size_t n=k==1?4:3;
        for(size_t i=0;i<n;i++) s4_need(insert(&a,k,i,model[i])==DS_OK,"prepare middle failure");
        s4_fail_at(1);
        s4_need(insert(&a,k,1,99)==DS_MEMORY,"middle allocation failure");
        verify_list(&a,k,model,n);
        s4_fail_at(0); lists_clear(&a); s4_need(s4_live()==0,"middle failure cleanup");
    }
    for(int k=1;k<4;k++) for(size_t failure=1;failure<=(k==1?4u:10u);failure++) {
        Lists a; lists_init(&a); int model[65]={0}; size_t n=0; int seen=0;
        s4_fail_at(failure);
        for(size_t i=0;i<(k==1?17u:10u);i++) { DsStatus status=insert(&a,k,n,(int)i); if(status==DS_MEMORY) { seen=1; verify_list(&a,k,model,n); break; } s4_need(status==DS_OK,"allocation sequence status"); model[n++]=(int)i; verify_list(&a,k,model,n); }
        s4_need(seen,"specified allocation failed"); s4_fail_at(0); lists_clear(&a); s4_need(s4_live()==0,"allocation failure cleanup");
    }
    for(int k=1;k<=3;k+=2) for(size_t failure=1;failure<=10;failure++) {
        Ends a; ends_init(&a,3); int model[65]={0}; size_t n=0; int seen=0; s4_fail_at(failure);
        for(size_t i=0;i<10;i++) { DsStatus status=push(&a,k,(int)i); if(status==DS_MEMORY) { seen=1; verify_ends(&a,k,model,n); break; } s4_need(status==DS_OK,"end allocation sequence"); model[n++]=(int)i; }
        s4_need(seen,"end allocation failed"); s4_fail_at(0); ends_clear(&a,3); s4_need(s4_live()==0,"end failure cleanup");
    }
    Vector v; vec_init(&v); s4_need(vec_reserve(&v,0)==DS_OK && v.data==NULL,"zero reserve");
    s4_need(vec_reserve(&v,4)==DS_OK,"initial reserve"); s4_fail_at(1);
    s4_need(vec_reserve(&v,2)==DS_OK && v.capacity==4 && s4_requests()==0,"reserve does not shrink");
    s4_need(vec_reserve(&v,(size_t)-1)==DS_FULL,"reserve budget first"); s4_fail_at(0); vec_clear(&v);
    Queue q; s4_need(queue_init(&q,3)==DS_OK,"valid queue init");
    s4_need(queue_init(&q,0)==DS_INVALID && queue_init(&q,17)==DS_INVALID && q.capacity==3 && q.count==0,"invalid queue init preserves state");
    s4_need(s4_live()==0,"final live allocations zero");
}
int main(void)
{
    s4_fail_at(0); list_models(); end_models(); failures();
    puts("list_steps=20000 end_steps=57000 allocation_failures=47 live=0");
    return 0;
}
