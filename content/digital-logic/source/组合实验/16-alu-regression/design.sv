module alu_extended(
  input logic [3:0] a, b,
  input logic [2:0] op,
  output logic [3:0] y,
  output logic carry, overflow, zero, valid_op
);
  logic [4:0] wide;
  always_comb begin
    wide = 5'b00000;
    y = 4'b0000;
    carry = 1'b0;
    overflow = 1'b0;
    valid_op = 1'b1;
    case (op)
      3'b000: begin
        wide = {1'b0, a} + {1'b0, b};
        y = wide[3:0];
        carry = wide[4];
        overflow = ~(a[3] ^ b[3]) & (y[3] ^ a[3]);
      end
      3'b001: begin
        wide = {1'b0, a} + {1'b0, ~b} + 5'd1;
        y = wide[3:0];
        carry = wide[4];
        overflow = (a[3] ^ b[3]) & (y[3] ^ a[3]);
      end
      3'b010: y = a & b;
      3'b011: y = a ^ b;
      3'b100: y = a | b;
      default: begin
        y = 4'b0000;
        valid_op = 1'b0;
      end
    endcase
  end
  assign zero = (y == 4'b0000);
endmodule
