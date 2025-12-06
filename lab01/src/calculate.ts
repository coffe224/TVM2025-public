import { Dict, MatchResult, Semantics } from "ohm-js";
import grammar, { AddMulActionDict } from "./addmul.ohm-bundle";

export const addMulSemantics: AddMulSemantics = grammar.createSemantics() as AddMulSemantics;


const addMulCalc = {
    /// write the action rules here
    AddExp_plus(x, _, y) {
        return x.calculate() + y.calculate();
    },

    MulExp_times(x, _, y) {
        return x.calculate() * y.calculate();
    },

    PriExp_brackets(_, x, __) {
        return x.calculate();
    },

    num(x) {
        return parseInt(x.sourceString);
    },
} satisfies AddMulActionDict<number>

addMulSemantics.addOperation<Number>("calculate()", addMulCalc);

interface AddMulDict  extends Dict {
    calculate(): number;
}

interface AddMulSemantics extends Semantics
{
    (match: MatchResult): AddMulDict;
}
