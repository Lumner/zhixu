module bits_demo(input logic [7:0] data, output logic [7:0] swapped,
                 output logic odd);
  assign swapped={data[3:0],data[7:4]};
  assign odd=^data;
endmodule
