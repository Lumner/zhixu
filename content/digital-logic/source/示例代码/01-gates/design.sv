module gates(input logic a,b, output logic y_and,y_xor);
  assign y_and=a&b;
  assign y_xor=a^b;
endmodule
