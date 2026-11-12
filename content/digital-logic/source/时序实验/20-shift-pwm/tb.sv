`timescale 1ns/1ps
module tb;
  logic clk=0,rst,shift_en,serial_in,pwm;
  logic [3:0] duty,q;
  logic [2:0] phase;
  integer high_count;
  shift_pwm dut(.clk(clk),.rst(rst),.shift_en(shift_en),.serial_in(serial_in),
    .duty(duty),.q(q),.phase(phase),.pwm(pwm));
  always #5 clk=~clk;
  task automatic shift_step(input logic enable_value,bit_value,
      input logic [3:0] want);
    @(negedge clk); rst=0;shift_en=enable_value;serial_in=bit_value;
    @(posedge clk); #1;
    if (q !== want) $fatal(1,"shift en=%b bit=%b actual=%b expected=%b",shift_en,serial_in,q,want);
  endtask
  initial begin
    rst=1; shift_en=0;serial_in=0;duty=0;
    shift_step(1,1,4'b0001);
    shift_step(1,0,4'b0010);
    shift_step(1,1,4'b0101);
    shift_step(1,1,4'b1011);
    shift_step(0,0,4'b1011);
    for (int d=0; d<16; d++) begin
      @(negedge clk); rst=1;shift_en=0;duty=d[3:0];
      @(posedge clk); #1;
      if (pwm !== 1'b0 || phase !== 3'b000) $fatal(1,"PWM reset must force low/phase0");
      @(negedge clk); rst=0;
      high_count=0;
      for (int slot=0; slot<8; slot++) begin
        #1;
        if (phase !== slot[2:0] || pwm !== (slot<d))
          $fatal(1,"PWM duty=%0d slot=%0d phase=%0d pwm=%b",d,slot,phase,pwm);
        if (pwm) high_count++;
        @(posedge clk); #1;
      end
      if (high_count != ((d>=8)?8:d)) $fatal(1,"PWM high count duty=%0d count=%0d",d,high_count);
      $display("TRACE pwm duty=%0d high=%0d/8",d,high_count);
    end
    duty=0; #1;
    if (pwm !== 1'b0) $fatal(1,"live duty=0 must change output without a clock");
    duty=8; #1;
    if (pwm !== 1'b1) $fatal(1,"live duty=8 must change output without a clock");
    $display("PASS shift/PWM: 5 shift checks, 16 full frames, 128 phase samples, 2 live changes");
    $finish;
  end
  initial begin #2000; $fatal(1,"shift/PWM timeout"); end
endmodule
