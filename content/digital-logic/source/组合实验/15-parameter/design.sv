module parameter_demo #(
  parameter integer WIDTH = 4,
  parameter integer DEPTH = 5,
  localparam integer AW = (DEPTH <= 1) ? 1 : $clog2(DEPTH)
)(
  input logic [WIDTH-1:0] a, b,
  input logic [AW-1:0] addr,
  input logic [3:0] digit,
  output logic [WIDTH-1:0] y,
  output logic odd, addr_ok, digit_ok
);
  function automatic logic is_bcd(input logic [3:0] value);
    return value <= 4'd9;
  endfunction

  generate
    for (genvar i=0; i<WIDTH; i++) begin : g_xor
      assign y[i] = a[i] ^ b[i];
    end
  endgenerate
  assign odd = ^a;
  assign addr_ok = ({1'b0, addr} < DEPTH);
  assign digit_ok = is_bcd(digit);
endmodule
