import { MatchResult } from "ohm-js";
import grammar, { ArithmeticActionDict, ArithmeticSemantics } from "./arith.ohm-bundle";

export const arithSemantics: ArithSemantics = grammar.createSemantics() as ArithSemantics;

export class DivisionByZeroError extends Error
{
}

const arithCalc = {
    Expr(expr) {
        return expr.calculate(this.args.params);
    },

    AddExpr(expr, it1, it2) {
        let result : number = expr.calculate(this.args.params);

        const ops = it1.children;
        const args = it2.children;

        for (let i = 0; i < ops.length; i++) {
            if (ops[i].sourceString == "+") {
                result += args[i].calculate(this.args.params);
            } else if (ops[i].sourceString == "-") {
                result -= args[i].calculate(this.args.params)
            } else {
                throw Error;
            }
        }
        return result;
    },

    MulExpr(expr, it1, it2) {
        let result : number = expr.calculate(this.args.params);

        const ops = it1.children;
        const args = it2.children;

        for (let i = 0; i < ops.length; i++) {
            if (ops[i].sourceString == "*") {
                result *= args[i].calculate(this.args.params);
            } else if (ops[i].sourceString == "/") {
                let num = args[i].calculate(this.args.params);
                if (num === 0) {
                    throw DivisionByZeroError;
                }
                result /= args[i].calculate(this.args.params)
            } else {
                throw Error;
            }
        }
        return result;
    },

    AtomExpr(expr) {
        return expr.calculate(this.args.params);
    },

    NegExpr(_, expr) {
        return - expr.calculate(this.args.params);
    },

    BracExpr(_, expr, __) {
        return expr.calculate(this.args.params);
    },

    variable(_, __) {
        const variableName : string = this.sourceString;
        if (variableName in this.args.params) {
            return this.args.params[variableName];
        } else {
            return NaN;
        }
    },

    num(_) {
        return parseInt(this.sourceString);
    }
} satisfies ArithmeticActionDict<number | undefined>;


arithSemantics.addOperation<Number>("calculate(params)", arithCalc);


export interface ArithActions {
    calculate(params: {[name:string]:number}): number;
}

export interface ArithSemantics extends ArithmeticSemantics
{
    (match: MatchResult): ArithActions;
}
