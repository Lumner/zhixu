#include "stage4-test.h"
#include "brackets.h"
#include "expression.h"
#include <stdio.h>
#include <string.h>

static unsigned long bracket_cases, expression_cases;
static int reduced_valid(const char *text)
{
    char remaining[8]; size_t count=0;
    for(size_t i=0;text[i]!='\0';i++) if(text[i]!='x') remaining[count++]=text[i];
    for(;;) {
        int changed=0;
        for(size_t i=0;i+1<count;i++) {
            if((remaining[i]=='(' && remaining[i+1]==')') || (remaining[i]=='[' && remaining[i+1]==']')) {
                memmove(remaining+i,remaining+i+2,count-i-2); count-=2; changed=1; break;
            }
        }
        if(!changed) break;
    }
    return count==0;
}
static void bracket_words(char *text,size_t at,size_t length)
{
    if(at==length) {
        text[length]='\0'; size_t position=777;
        BracketStatus status=brackets_check(text,&position);
        int valid=reduced_valid(text);
        s4_need((status==B_OK)==valid,"bracket reduction oracle");
        if(valid) s4_need(position==777,"successful bracket output unchanged");
        else s4_need((status==B_MISMATCH || status==B_UNCLOSED) && position<length && text[position]!='x',"bracket diagnostic bounds");
        bracket_cases++; return;
    }
    const char alphabet[]="()[]x";
    for(size_t i=0;i<5;i++) { text[at]=alphabet[i]; bracket_words(text,at+1,length); }
}

typedef struct { ExprStatus status; int value; size_t token; } Expected;
static Expected number(int value) { Expected r={E_OK,value,777}; return r; }
static Expected apply(Expected left,Expected right,char op,size_t token)
{
    if(left.status!=E_OK) return left;
    if(right.status!=E_OK) return right;
    Expected r={E_OK,0,777}; long result=0;
    if(op=='+') result=(long)left.value+right.value;
    else if(op=='-') result=(long)left.value-right.value;
    else if(op=='*') result=(long)left.value*right.value;
    else if(right.value==0) { r.status=E_DIVZERO; r.token=token; return r; }
    else result=(long)left.value/right.value;
    if(result < -9999 || result > 9999) { r.status=E_RANGE; r.token=token; }
    else r.value=(int)result;
    return r;
}
static void expressions(void)
{
    const char ops[]="+-*/";
    for(int a=0;a<4;a++) for(int b=0;b<4;b++) for(int c=0;c<4;c++) for(int d=0;d<4;d++)
    for(size_t i=0;i<4;i++) for(size_t j=0;j<4;j++) for(size_t k=0;k<4;k++) for(int shape=0;shape<5;shape++) {
        char text[32]; Expected x,y,r;
        if(shape==0) {
            snprintf(text,sizeof text,"%d %d %c %d %c %d %c",a,b,ops[i],c,ops[j],d,ops[k]);
            x=apply(number(a),number(b),ops[i],2); y=apply(x,number(c),ops[j],4); r=apply(y,number(d),ops[k],6);
        } else if(shape==1) {
            snprintf(text,sizeof text,"%d %d %d %c %c %d %c",a,b,c,ops[i],ops[j],d,ops[k]);
            x=apply(number(b),number(c),ops[i],3); y=apply(number(a),x,ops[j],4); r=apply(y,number(d),ops[k],6);
        } else if(shape==2) {
            snprintf(text,sizeof text,"%d %d %c %d %d %c %c",a,b,ops[i],c,d,ops[j],ops[k]);
            x=apply(number(a),number(b),ops[i],2); y=apply(number(c),number(d),ops[j],5); r=apply(x,y,ops[k],6);
        } else if(shape==3) {
            snprintf(text,sizeof text,"%d %d %d %c %d %c %c",a,b,c,ops[i],d,ops[j],ops[k]);
            x=apply(number(b),number(c),ops[i],3); y=apply(x,number(d),ops[j],5); r=apply(number(a),y,ops[k],6);
        } else {
            snprintf(text,sizeof text,"%d %d %d %d %c %c %c",a,b,c,d,ops[i],ops[j],ops[k]);
            x=apply(number(c),number(d),ops[i],4); y=apply(number(b),x,ops[j],5); r=apply(number(a),y,ops[k],6);
        }
        int out=777; size_t at=777;
        ExprStatus status=expression_evaluate(text,&out,&at);
        s4_need(status==r.status,"expression AST status");
        if(status==E_OK) s4_need(out==r.value && at==777,"expression AST value");
        else s4_need(out==777 && at==r.token,"expression failure preservation and position");
        expression_cases++;
    }
}
int main(void)
{
    char text[8]; for(size_t n=0;n<=7;n++) bracket_words(text,0,n);
    s4_need(bracket_cases==97656UL,"bracket enumeration count");
    expressions(); s4_need(expression_cases==81920UL,"expression enumeration count");
    size_t position=777; int out=777;
    s4_need(brackets_check(NULL,&position)==B_INVALID && position==777,"null bracket text");
    s4_need(brackets_check("()",NULL)==B_INVALID,"null bracket output");
    s4_need(expression_evaluate(NULL,&out,&position)==E_INVALID && out==777 && position==777,"null expression input");
    s4_need(expression_evaluate("1",NULL,&position)==E_INVALID && expression_evaluate("1",&out,NULL)==E_INVALID,"null expression outputs");
    const char *bad_texts[]={"2 +","2 3","8 0 /","12 3 +","9 9 * 9 * 9 * 9 *","1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1",""};
    const ExprStatus statuses[]={E_ARITY,E_ARITY,E_DIVZERO,E_TOKEN,E_RANGE,E_CAPACITY,E_ARITY};
    const size_t positions[]={1,2,2,0,8,16,0};
    for(size_t i=0;i<7;i++) { out=777; position=777; s4_need(expression_evaluate(bad_texts[i],&out,&position)==statuses[i] && out==777 && position==positions[i],"explicit expression error contract"); }
    char long_text[258]; memset(long_text,'x',257); long_text[257]='\0';
    s4_need(brackets_check(long_text,&position)==B_LENGTH && position==256,"bracket length");
    memset(long_text,' ',128); long_text[128]='\0'; out=777; position=777;
    s4_need(expression_evaluate(long_text,&out,&position)==E_LENGTH && position==0 && out==777,"expression length");
    s4_need(s4_live()==0,"applications allocate no heap");
    printf("bracket_words=%lu expression_trees=%lu live=0\n",bracket_cases,expression_cases);
    return 0;
}
