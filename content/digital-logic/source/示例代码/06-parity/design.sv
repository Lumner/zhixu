module parity #(parameter integer WIDTH=8)(input logic [WIDTH-1:0] data,
                                           output logic odd);
  assign odd=^data;
endmodule
