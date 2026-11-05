module comb_panel(
  input logic [3:0] a,b,
  input logic sel,clear,
  input logic [1:0] op,
  output logic [3:0] selected,operation
);
  always_comb begin
    selected=4'b0000;
    if (!clear) begin
      if (sel) selected=b;
      else selected=a;
    end
    operation=4'b0000;
    case(op)
      2'b00: operation=a;
      2'b01: operation=b;
      2'b10: operation=a&b;
      2'b11: operation=a^b;
      default: operation=4'b0000;
    endcase
  end
endmodule
