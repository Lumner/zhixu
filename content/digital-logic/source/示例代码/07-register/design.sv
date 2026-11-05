module data_reg(input logic clk,rst,en,input logic [7:0] d,output logic [7:0] q);
  always_ff @(posedge clk) begin
    if(rst) q<=8'b0;
    else if(en) q<=d;
  end
endmodule
