module tick_counter #(
  parameter integer DIV=4,
  localparam integer CW=(DIV<=1)?1:$clog2(DIV)
)(
  input logic clk,rst,en,
  output logic [CW-1:0] count,
  output logic tick,
  output logic [3:0] events
);
  assign tick=en && !rst && (count == DIV-1);
  always_ff @(posedge clk) begin
    if (rst) count <= '0;
    else if (en) begin
      if (tick) count <= '0;
      else count <= count + 1'b1;
    end
  end
  always_ff @(posedge clk) begin
    if (rst) events <= 4'h0;
    else if (tick) events <= events + 1'b1;
  end
endmodule
