module uart_tx #(parameter integer CLKS_PER_BIT=4)(
  input logic clk,rst,start,input logic [7:0] data,
  output logic tx,busy
);
  localparam integer CW=(CLKS_PER_BIT<=1)?1:$clog2(CLKS_PER_BIT);
  logic [CW-1:0] count;
  logic [9:0] frame;
  logic [3:0] bit_index;
  always_ff @(posedge clk) begin
    if(rst) begin tx<=1; busy<=0; count<=0; frame<='1; bit_index<=0; end
    else if(!busy) begin
      tx<=1;
      if(start) begin
        frame<={1'b1,data,1'b0}; tx<=0; busy<=1; count<=0; bit_index<=0;
      end
    end else if(count==CLKS_PER_BIT-1) begin
      count<=0;
      if(bit_index==9) begin busy<=0; tx<=1; end
      else begin
        frame<={1'b1,frame[9:1]}; tx<=frame[1]; bit_index<=bit_index+1'b1;
      end
    end else count<=count+1'b1;
  end
endmodule
