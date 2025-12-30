import * as arith from "../../lab04";

export interface Module
{
    type: "module";
    functions: FunctionDef[]
}

export interface FunctionDef
{
    type: "fun";
    name: string;
    parameters: ParameterDef[];
    returns: ParameterDef[];
    locals: ParameterDef[];
    body: Statement;
    loc?: Location;
}

export interface ParameterDef
{
    type: "param";
    name: string;
    varType: "int" | "int[]"; 
}

export type Statement = AssignSt | BlockSt | ConditionalSt | LoopSt | FunctionCallSt;

export type LValue = VarLValue | ArrLValue;

export interface VarLValue {
  type: "lvar";
  name: string;
}

export interface ArrLValue {
  type: "larr";
  name: string;
  index: Expr;
}

export interface AssignSt {
    type: "assign";
    targets: LValue[];
    exprs: Expr[];
    loc?: Location;
}

export interface BlockSt {
    type: "block";
    stmts: Statement[];
    loc?: Location;
}
export interface ConditionalSt {
    type: "if";
    condition: Condition;
    then: Statement;
    else: Statement | null;
    loc?: Location;
}

export interface LoopSt {
    type: "while";
    condition: Condition;
    invariant: Predicate | null;
    body: Statement;
    loc?: Location;
}

export interface FunctionCallSt {
    type: "funccallstmt";
    call: FuncCallExpr;
    loc?: Location;
}

export type Expr = arith.Expr | FuncCallExpr | ArrAccessExpr;

export interface FuncCallExpr {
    type: "funccall";
    name: string;
    args: Expr[];
    loc?: Location;
}

export interface ArrAccessExpr {
    type: "arraccess";
    name: string;
    index: Expr;
    loc?: Location;
}

export type Condition = TrueCond | FalseCond | ComparisonCond | NotCond | AndCond | OrCond | ImpliesCond | ParenCond;

export interface TrueCond {
    kind: "true";
    loc?: Location;
}

export interface FalseCond {
    kind: "false";
    loc?: Location;
}

export interface ComparisonCond {
    kind: "comparison";
    left: Expr;
    op: "==" | "!=" | ">" | "<" | ">=" | "<=";
    right: Expr;
    loc?: Location;
}

export interface NotCond {
    kind: "not";
    condition: Condition;
    loc?: Location;
}

export interface AndCond {
    kind: "and";
    left: Condition;
    right: Condition;
    loc?: Location;
}

export interface OrCond {
    kind: "or";
    left: Condition;
    right: Condition;
    loc?: Location;
}

export interface ImpliesCond {
    kind: "implies";
    left: Condition;
    right: Condition;
    loc?: Location;
}

export interface ParenCond {
    kind: "paren";
    inner: Condition;
    loc?: Location;   
}

export type Predicate = Quantifier | FormulaRef | FalseCond | TrueCond | ComparisonCond | NotPred | AndPred | OrPred | ParenPred | ImpliesPred;

export interface Quantifier {
    kind: "quantifier";
    quant: "forall" | "exists";
    varName: string;
    varType: "int" | "int[]";
    body: Predicate;
    loc?: Location;
}

export interface FormulaRef {
    kind: "formula";
    name: string;
    parameters: ParameterDef[];
    loc?: Location;
}

export interface NotPred {
    kind: "not";
    predicate: Predicate;
    loc?: Location;
}

export interface AndPred {
    kind: "and";
    left: Predicate;
    right: Predicate;
    loc?: Location;
}

export interface OrPred {
    kind: "or";
    left: Predicate;
    right: Predicate;
    loc?: Location;
}

export interface ParenPred {
    kind: "paren";
    inner: Predicate;
    loc?: Location;
}

export interface ImpliesPred {
    kind: "implies";
    left: Predicate;
    right: Predicate;
    loc?: Location;
}

export interface Location {
    file?: string;
    startLine: number;
    startCol: number;
    endLine?: number;
    endCol?: number;
}