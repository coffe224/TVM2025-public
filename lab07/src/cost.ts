import { Expr } from "../../lab04";

export function cost(e: Expr): number
{
    switch (e.type) {
        case 'number':
            return 0;
        
        case 'variable':
            return 1;
        
        case 'unary_min':
            return cost(e.arg) + 1;
    
        case 'add_op':
        case 'div_op':
        case 'sub_op':
        case 'mul_op':
            return cost(e.left_arg) + cost(e.right_arg) + 1;
    }
}