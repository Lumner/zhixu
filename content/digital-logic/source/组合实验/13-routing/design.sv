module routing_demo(
  input logic [3:0] d0, d1, d2, d3,
  input logic [1:0] sel,
  input logic en,
  input logic [3:0] req,
  output logic [3:0] y, decoded,
  output logic valid,
  output logic [1:0] index
);
  always_comb begin
    y = 4'b0000;
    case (sel)
      2'd0: y = d0;
      2'd1: y = d1;
      2'd2: y = d2;
      2'd3: y = d3;
      default: y = 4'b0000;
    endcase

    decoded = 4'b0000;
    if (en) begin
      case (sel)
        2'd0: decoded = 4'b0001;
        2'd1: decoded = 4'b0010;
        2'd2: decoded = 4'b0100;
        2'd3: decoded = 4'b1000;
        default: decoded = 4'b0000;
      endcase
    end

    valid = 1'b0;
    index = 2'd0;
    if (req[3]) begin valid = 1'b1; index = 2'd3; end
    else if (req[2]) begin valid = 1'b1; index = 2'd2; end
    else if (req[1]) begin valid = 1'b1; index = 2'd1; end
    else if (req[0]) begin valid = 1'b1; index = 2'd0; end
  end
endmodule
