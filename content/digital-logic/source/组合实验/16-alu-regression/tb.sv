`timescale 1ns/1ps
module tb;
  logic [3:0] a, b, y, expected_y;
  logic [2:0] op;
  logic carry, overflow, zero, valid_op;
  logic expected_carry, expected_overflow, expected_zero, expected_valid;
  integer signed_a, signed_b, math_value, signed_math, count;
  alu_extended dut(.a(a), .b(b), .op(op), .y(y), .carry(carry),
    .overflow(overflow), .zero(zero), .valid_op(valid_op));
  initial begin
    $dumpfile("alu.vcd");
    $dumpvars(0,tb);
    count=0;
    for (int oi=0; oi<8; oi++) begin
      for (int ai=0; ai<16; ai++) begin
        for (int bi=0; bi<16; bi++) begin
          a=ai[3:0]; b=bi[3:0]; op=oi[2:0];
          signed_a=(ai>=8) ? ai-16 : ai;
          signed_b=(bi>=8) ? bi-16 : bi;
          math_value=0; signed_math=0;
          expected_carry=1'b0;
          expected_overflow=1'b0;
          expected_valid=(oi<5);
          case (oi)
            0: begin
              math_value=ai+bi;
              signed_math=signed_a+signed_b;
              expected_carry=(math_value>15);
            end
            1: begin
              math_value=ai-bi;
              signed_math=signed_a-signed_b;
              expected_carry=(ai>=bi);
            end
            2: math_value=ai & bi;
            3: math_value=ai ^ bi;
            4: math_value=ai | bi;
            default: math_value=0;
          endcase
          if (oi<2)
            expected_overflow=(signed_math < -8 || signed_math > 7);
          expected_y=math_value[3:0];
          expected_zero=(expected_y==4'b0000);
          #1;
          if ({y,carry,overflow,zero,valid_op} !==
              {expected_y,expected_carry,expected_overflow,expected_zero,expected_valid})
            $fatal(1, "alu op=%03b a=%h b=%h actual y/C/V/Z/valid=%h/%b/%b/%b/%b expected=%h/%b/%b/%b/%b",
              op,a,b,y,carry,overflow,zero,valid_op,
              expected_y,expected_carry,expected_overflow,expected_zero,expected_valid);
          count++;
        end
      end
    end
    $display("PASS extended ALU: %0d binary input cases including 3 reserved opcodes",count);
    $finish;
  end
  initial begin #3000; $fatal(1, "ALU regression timeout"); end
endmodule
