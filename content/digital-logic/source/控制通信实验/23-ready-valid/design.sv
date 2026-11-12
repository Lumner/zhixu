module stream1(
  input logic clk,rst,
  input logic in_valid,
  input logic [7:0] in_data,
  output logic in_ready,
  output logic out_valid,
  output logic [7:0] out_data,
  input logic out_ready
);
  logic full;
  logic [7:0] stored;
  assign in_ready=!rst && (!full || out_ready);
  assign out_valid=!rst && full;
  assign out_data=stored;
  always_ff @(posedge clk) begin
    if (rst) begin full<=1'b0;stored<=8'h00;end
    else if (in_ready) begin
      full<=in_valid;
      if (in_valid) stored<=in_data;
    end
  end
endmodule
