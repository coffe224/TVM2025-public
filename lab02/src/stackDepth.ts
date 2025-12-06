import { ReversePolishNotationActionDict } from "./rpn.ohm-bundle";

export const rpnStackDepth = {
    Expr_plus(expr1, expr2, _) {
        const stackDepth : StackDepth = {
            max: Math.max(expr1.stackDepth.max, expr2.stackDepth.max + 1),
            out: 1
        }
        return stackDepth
    },

    Expr_mult(expr1, expr2, _) {
        const stackDepth : StackDepth = {
            max: Math.max(expr1.stackDepth.max, expr2.stackDepth.max + 1),
            out: 1
            // ??? я чет не понимаю ???
        }
        return stackDepth
    },

    Expr(num) {
        return num.stackDepth;
    },

    num(x) {
        const stackDepth : StackDepth = {max: 1, out: 1};
        return stackDepth;
    }

} satisfies ReversePolishNotationActionDict<StackDepth>;
export type StackDepth = {max: number, out: number};
