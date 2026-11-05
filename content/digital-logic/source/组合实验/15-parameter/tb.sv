`timescale 1ns/1ps
module tb;
  logic a1, b1, y1, addr1;
  logic [3:0] a4, b4, y4, digit;
  logic [6:0] a7, b7, y7;
  logic [2:0] addr5, addr8;
  logic odd1, odd4, odd7, ok1, ok5, ok8, bcd1, bcd4, bcd7;
  logic expected_odd;
  integer data_checks, address_checks, digit_checks;
  parameter_demo #(.WIDTH(1), .DEPTH(1)) u1(
    .a(a1), .b(b1), .addr(addr1), .digit(digit),
    .y(y1), .odd(odd1), .addr_ok(ok1), .digit_ok(bcd1));
  parameter_demo #(.WIDTH(4), .DEPTH(5)) u4(
    .a(a4), .b(b4), .addr(addr5), .digit(digit),
    .y(y4), .odd(odd4), .addr_ok(ok5), .digit_ok(bcd4));
  parameter_demo #(.WIDTH(7), .DEPTH(8)) u7(
    .a(a7), .b(b7), .addr(addr8), .digit(digit),
    .y(y7), .odd(odd7), .addr_ok(ok8), .digit_ok(bcd7));
  initial begin
    a1=0; b1=0; a4=0; b4=0; a7=0; b7=0;
    addr1=0; addr5=0; addr8=0; digit=0;
    data_checks=0; address_checks=0; digit_checks=0;
    for (int ai=0; ai<2; ai++) begin
      for (int bi=0; bi<2; bi++) begin
        a1=ai[0]; b1=bi[0]; #1;
        if (y1 !== (ai[0]^bi[0]) || odd1 !== ai[0])
          $fatal(1, "WIDTH=1 a=%0d b=%0d", ai, bi);
        data_checks++;
      end
    end
    for (int ai=0; ai<16; ai++) begin
      expected_odd=1'b0;
      for (int k=0; k<4; k++)
        if (ai & (1<<k)) expected_odd=~expected_odd;
      for (int bi=0; bi<16; bi++) begin
        a4=ai[3:0]; b4=bi[3:0]; #1;
        if (y4 !== (ai[3:0]^bi[3:0]) || odd4 !== expected_odd)
          $fatal(1, "WIDTH=4 a=%0d b=%0d", ai, bi);
        data_checks++;
      end
    end
    for (int ai=0; ai<128; ai++) begin
      expected_odd=1'b0;
      for (int k=0; k<7; k++)
        if (ai & (1<<k)) expected_odd=~expected_odd;
      for (int bi=0; bi<128; bi++) begin
        a7=ai[6:0]; b7=bi[6:0]; #1;
        if (y7 !== (ai[6:0]^bi[6:0]) || odd7 !== expected_odd)
          $fatal(1, "WIDTH=7 a=%0d b=%0d", ai, bi);
        data_checks++;
      end
    end
    for (int ad=0; ad<2; ad++) begin
      addr1=ad[0]; #1;
      if (ok1 !== (ad<1)) $fatal(1, "DEPTH=1 addr=%0d", ad);
      address_checks++;
    end
    for (int ad=0; ad<8; ad++) begin
      addr5=ad[2:0]; addr8=ad[2:0]; #1;
      if (ok5 !== (ad<5) || ok8 !== (ad<8))
        $fatal(1, "DEPTH=5/8 addr=%0d", ad);
      address_checks=address_checks+2;
    end
    for (int d=0; d<16; d++) begin
      digit=d[3:0]; #1;
      if (bcd1 !== (d<10) || bcd4 !== (d<10) || bcd7 !== (d<10))
        $fatal(1, "BCD digit=%0d", d);
      digit_checks++;
    end
    $display("PASS parameter: data=%0d address=%0d digit=%0d; WIDTH=1/4/7 DEPTH=1/5/8",
      data_checks,address_checks,digit_checks);
    $finish;
  end
  initial begin #20000; $fatal(1, "parameter timeout"); end
endmodule
