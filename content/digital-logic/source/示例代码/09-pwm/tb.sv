`timescale 1ns/1ps
module tb;
  logic clk=0,rst=1,pwm;
  logic [3:0] duty=0;
  integer highs;
  always #5 clk=~clk;
  pwm8 dut(.clk(clk),.rst(rst),.duty(duty),.pwm(pwm));
  initial begin
    for(int d=0;d<=8;d++) begin
      @(negedge clk); rst=1; duty=d;
      @(posedge clk); #1;
      @(negedge clk); rst=0;
      highs=0;
      repeat(8) begin
        @(posedge clk); #1;
        if(pwm!==1'b0 && pwm!==1'b1) $fatal(1,"PWM unknown");
        if(pwm) highs++;
      end
      if(highs!=d) $fatal(1,"PWM duty=%0d highs=%0d",d,highs);
    end
    $display("PASS PWM: duty 0 through 8, complete periods"); $finish;
  end
  initial begin #2000; $fatal(1,"PWM timeout"); end
endmodule
