module decoder(input logic en, input logic [1:0] sel, output logic [3:0] y);
  always_comb begin
    y=4'b0;
    if(en) begin
      case(sel)
        2'd0: y=4'b0001;
        2'd1: y=4'b0010;
        2'd2: y=4'b0100;
        2'd3: y=4'b1000;
        default: y=4'b0;
      endcase
    end
  end
endmodule
