module traffic3(
  input logic clk,rst,advance,
  output logic red,green,yellow,
  output logic [1:0] state_code
);
  typedef enum logic [1:0] {S_RED=2'd0,S_GREEN=2'd1,S_YELLOW=2'd2} state_t;
  state_t state,next_state;
  always_comb begin
    next_state=state;
    red=1'b0;green=1'b0;yellow=1'b0;
    case (state)
      S_RED: begin red=1'b1; if (advance) next_state=S_GREEN; end
      S_GREEN: begin green=1'b1; if (advance) next_state=S_YELLOW; end
      S_YELLOW: begin yellow=1'b1; if (advance) next_state=S_RED; end
      default: begin red=1'b1;next_state=S_RED; end
    endcase
  end
  always_ff @(posedge clk) begin
    if (rst) state <= S_RED;
    else state <= next_state;
  end
  assign state_code=state;
endmodule
