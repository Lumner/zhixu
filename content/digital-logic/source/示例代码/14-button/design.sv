module button_filter #(parameter integer STABLE_CYCLES=3)(
  input logic clk,rst,async_in,output logic stable,pressed
);
  localparam integer CW=(STABLE_CYCLES<=1)?1:$clog2(STABLE_CYCLES);
  logic sync1,sync2;
  logic [CW-1:0] count;
  // FPGA工程中还需按器件流程声明同步器属性并检查CDC/布局。
  always_ff @(posedge clk) begin
    if(rst) begin sync1<=0; sync2<=0; stable<=0; pressed<=0; count<=0; end
    else begin
      sync1<=async_in; sync2<=sync1; pressed<=0;
      if(sync2==stable) count<=0;
      else if(count==STABLE_CYCLES-1) begin
        stable<=sync2; pressed<=sync2; count<=0;
      end else count<=count+1'b1;
    end
  end
endmodule
