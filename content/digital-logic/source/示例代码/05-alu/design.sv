module alu(input logic [3:0] a,b, input logic [1:0] op,
           output logic [3:0] y, output logic carry,overflow,zero);
  logic [4:0] wide;
  always_comb begin
    y=4'b0; wide=5'b0; carry=1'b0; overflow=1'b0;
    case(op)
      2'b00: begin
        wide={1'b0,a}+{1'b0,b}; y=wide[3:0]; carry=wide[4];
        overflow=~(a[3]^b[3]) & (y[3]^a[3]);
      end
      2'b01: begin
        wide={1'b0,a}+{1'b0,~b}+5'd1; y=wide[3:0]; carry=wide[4];
        overflow=(a[3]^b[3]) & (y[3]^a[3]);
      end
      2'b10: y=a&b;
      2'b11: y=a^b;
      default: y=4'b0;
    endcase
  end
  assign zero=(y==4'b0);
endmodule
