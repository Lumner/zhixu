module tick_gen #(parameter integer DIV=4)(input logic clk,rst,en,output logic tick);
  localparam integer CW=(DIV<=1)?1:$clog2(DIV);
  logic [CW-1:0] count;
  assign tick=en && !rst && (count==DIV-1);
  always_ff @(posedge clk) begin
    if(rst) count<='0;
    else if(en) begin
      if(tick) count<='0;
      else count<=count+1'b1;
    end
  end
endmodule
