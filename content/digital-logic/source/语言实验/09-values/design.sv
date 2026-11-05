module values_demo(
  input logic [7:0] data,
  input logic signed [3:0] nibble_value,
  output logic [7:0] swapped, zero_extended,
  output logic signed [7:0] sign_extended,
  output logic odd
);
  assign swapped = {data[3:0], data[7:4]};
  assign zero_extended = {4'b0000, nibble_value};
  assign sign_extended = {{4{nibble_value[3]}}, nibble_value};
  assign odd = ^data;
endmodule
