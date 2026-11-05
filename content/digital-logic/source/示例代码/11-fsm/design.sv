module traffic(input logic clk,rst,advance,output logic red,green);
  typedef enum logic {RED,GREEN} state_t;
  state_t state,next;
  always_comb begin
    next=state;
    case(state)
      RED: if(advance) next=GREEN;
      GREEN: if(advance) next=RED;
      default: next=RED;
    endcase
  end
  always_ff @(posedge clk) begin
    if(rst) state<=RED;
    else state<=next;
  end
  assign red=(state==RED);
  assign green=(state==GREEN);
endmodule
