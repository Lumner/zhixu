module mux2(input logic [3:0] a,b, input logic sel, output logic [3:0] y);
  always_comb begin
    if(sel) y=b;
    else y=a;
  end
endmodule
