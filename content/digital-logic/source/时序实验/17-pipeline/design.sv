module pipeline2(
  input logic clk, rst,
  input logic [3:0] d,
  output logic [3:0] q1, q2
);
  always_ff @(posedge clk) begin
    if (rst) begin
      q1 <= 4'h0;
      q2 <= 4'h0;
    end else begin
      q1 <= d;
      q2 <= q1;
    end
  end
endmodule
