`timescale 1ns/1ps
module tb;
  logic [3:0] a,b,y;
  logic [1:0] op;
  logic carry,overflow,zero;
  integer expected,sa,sb,signed_result;
  logic ec,ev,ez;
  alu dut(.a(a),.b(b),.op(op),.y(y),.carry(carry),.overflow(overflow),.zero(zero));
  initial begin
    for(int oi=0;oi<4;oi++)
      for(int ai=0;ai<16;ai++)
        for(int bi=0;bi<16;bi++) begin
          a=ai; b=bi; op=oi;
          sa=(ai>=8)?ai-16:ai; sb=(bi>=8)?bi-16:bi;
          ec=0; ev=0;
          case(oi)
            0: begin
              expected=ai+bi; ec=(expected>15);
              signed_result=sa+sb; ev=(signed_result < -8 || signed_result > 7);
            end
            1: begin
              expected=ai-bi; ec=(ai>=bi);
              signed_result=sa-sb; ev=(signed_result < -8 || signed_result > 7);
            end
            2: expected=ai&bi;
            3: expected=ai^bi;
          endcase
          ez=((expected&15)==0); #1;
          if(y!==expected[3:0] || carry!==ec || overflow!==ev || zero!==ez)
            $fatal(1,"ALU a=%h b=%h op=%d actual=%h c=%b v=%b z=%b expected=%h c=%b v=%b z=%b",
              a,b,op,y,carry,overflow,zero,expected[3:0],ec,ev,ez);
        end
    $display("PASS ALU: 1024 combinations, data and flags"); $finish;
  end
endmodule
