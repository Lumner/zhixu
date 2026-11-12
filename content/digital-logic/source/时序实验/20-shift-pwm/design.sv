module shift_pwm(
  input logic clk,rst,shift_en,serial_in,
  input logic [3:0] duty,
  output logic [3:0] q,
  output logic [2:0] phase,
  output logic pwm
);
  always_ff @(posedge clk) begin
    if (rst) q <= 4'b0000;
    else if (shift_en) q <= {q[2:0],serial_in};
  end
  always_ff @(posedge clk) begin
    if (rst) phase <= 3'b000;
    else phase <= phase + 1'b1;
  end
  assign pwm=!rst && ({1'b0,phase}<duty);
endmodule
