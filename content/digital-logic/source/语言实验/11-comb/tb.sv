`timescale 1ns/1ps
module tb;
  logic [3:0] a,b,selected,operation,expected_selected,expected_operation;
  logic sel,clear;
  logic [1:0] op;
  comb_panel dut(.a(a),.b(b),.sel(sel),.clear(clear),.op(op),
    .selected(selected),.operation(operation));
  initial begin
    for (int ai=0;ai<16;ai++)
      for (int bi=0;bi<16;bi++)
        for (int control=0;control<16;control++) begin
          a=ai; b=bi; {clear,sel,op}=control[3:0];
          expected_selected=clear?4'b0:(sel?b:a);
          case(op)
            0: expected_operation=a;
            1: expected_operation=b;
            2: expected_operation=ai&bi;
            3: expected_operation=ai^bi;
          endcase
          #1;
          if (selected!==expected_selected || operation!==expected_operation)
            $fatal(1,"comb a=%h b=%h clear=%b sel=%b op=%b",a,b,clear,sel,op);
        end
    $display("PASS comb: 4096 input combinations");
    $finish;
  end
endmodule
