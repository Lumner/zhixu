`timescale 1ns/1ps
module tb;
  logic clk=0,rst,advance,red,green,yellow;
  logic [1:0] state_code;
  integer checks=0;
  traffic3 dut(.clk(clk),.rst(rst),.advance(advance),.red(red),
    .green(green),.yellow(yellow),.state_code(state_code));
  always #5 clk=~clk;
  task automatic step(input logic r,a,input logic [1:0] want_state,
      input logic [2:0] want_lamps);
    @(negedge clk);rst=r;advance=a;
    @(posedge clk);#1;
    if (state_code !== want_state || {red,green,yellow} !== want_lamps)
      $fatal(1,"FSM rst=%b advance=%b state=%0d lamps=%b expected=%0d/%b",
        rst,advance,state_code,{red,green,yellow},want_state,want_lamps);
    checks++;
    $display("TRACE FSM state=%0d lamps=%b",state_code,{red,green,yellow});
  endtask
  initial begin
    rst=1;advance=0;
    step(1,0,2'd0,3'b100);
    step(0,0,2'd0,3'b100);
    step(0,1,2'd1,3'b010);
    step(0,0,2'd1,3'b010);
    #1;advance=1;#1;
    if ({red,green,yellow} !== 3'b010) $fatal(1,"Moore lamps changed between edges");
    step(0,1,2'd2,3'b001);
    step(0,0,2'd2,3'b001);
    step(0,1,2'd0,3'b100);
    step(0,1,2'd1,3'b010);
    step(1,1,2'd0,3'b100);
    step(0,1,2'd1,3'b010);
    $display("PASS FSM: %0d edge cases, 6 transition-table rows, Moore hold and reset priority",checks);
    $finish;
  end
  initial begin #200;$fatal(1,"FSM timeout");end
endmodule
