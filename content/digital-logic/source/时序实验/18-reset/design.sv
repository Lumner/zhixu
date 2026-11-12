module reset_compare(
  input logic clk, rst, clear, en,
  input logic [3:0] d,
  output logic [3:0] sync_q, async_q
);
  always_ff @(posedge clk) begin
    if (rst) sync_q <= 4'h0;
    else if (clear) sync_q <= 4'h0;
    else if (en) sync_q <= d;
  end
  always_ff @(posedge clk or posedge rst) begin
    if (rst) async_q <= 4'h0;
    else if (clear) async_q <= 4'h0;
    else if (en) async_q <= d;
  end
endmodule
