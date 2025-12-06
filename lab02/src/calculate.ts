import { ReversePolishNotationActionDict} from "./rpn.ohm-bundle";

export const rpnCalc = {
    Expr_plus(expr1, expr2, _) {
        return expr1.calculate() + expr2.calculate();
    },

    Expr_mult(expr1, expr2, _) {
        return expr1.calculate() * expr2.calculate();
    },

    Expr(num) {
        return num.calculate()
    },

    num(x) {
        return parseInt(x.sourceString);
    }
} satisfies ReversePolishNotationActionDict<number>;
