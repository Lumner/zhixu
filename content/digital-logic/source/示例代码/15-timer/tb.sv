`timescale 1ns/1ps
module tb;
  logic clk=0,rst=1,toggle=0,clear=0,run3,run1;
  logic [5:0] sec3,sec1;
  integer elapsed3=0,elapsed1=0,steps=0,wraps3=0,wraps1=0;
  logic model_run=0;
  always #5 clk=~clk;
  timer_core #(.CLKS_PER_SEC(3)) t3(.clk(clk),.rst(rst),.toggle(toggle),.clear(clear),
                                   .running(run3),.seconds(sec3));
  timer_core #(.CLKS_PER_SEC(1)) t1(.clk(clk),.rst(rst),.toggle(toggle),.clear(clear),
                                   .running(run1),.seconds(sec1));
  task automatic step(input logic r,t,c);
    integer expected3,expected1;
    @(negedge clk); rst=r; toggle=t; clear=c;
    @(posedge clk);
    // 参考模型保存总有效拍数，以除法/取模计算秒数，独立于DUT的phase结构。
    if(r || c) begin elapsed3=0; elapsed1=0; model_run=0; end
    else if(t) model_run=!model_run;
    else if(model_run) begin
      elapsed3++ ; elapsed1++;
      if(elapsed3%180==0) wraps3++;
      if(elapsed1%60==0) wraps1++;
    end
    expected3=(elapsed3/3)%60; expected1=elapsed1%60;
    #1; steps++;
    if(run3!==model_run || run1!==model_run || sec3!==expected3[5:0] || sec1!==expected1[5:0])
      $fatal(1,"timer step=%0d actual=%0d/%0d expected=%0d/%0d run=%b/%b",
        steps,sec3,sec1,expected3,expected1,run3,model_run);
  endtask
  initial begin
    step(1,0,0); step(0,1,0);
    step(0,0,0); step(0,0,0); // 部分秒为2拍
    step(0,1,0); repeat(5) step(0,0,0); // 暂停保持
    step(0,1,0); step(0,0,0); // 恢复补满一秒
    repeat(200) step(0,0,0);   // 两种参数都覆盖59到0
    step(0,1,1);              // clear优先于toggle
    repeat(4) step(0,0,0);
    step(0,1,0); repeat(7) step(0,0,0);
    step(1,1,1);              // 复位冲突
    if(wraps3<1 || wraps1<1) $fatal(1,"timer wrap not covered");
    $display("PASS timer: %0d cycles, parameter 1/3, partial pause/resume, clear priority, wrap",steps);
    $finish;
  end
  initial begin #10000; $fatal(1,"timer timeout"); end
endmodule
