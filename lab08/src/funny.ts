import * as arith from "@tvm/lab04";

export interface Module
{
    type: 'module';
    functions: FunctionDef[]
}

export interface FunctionDef
{
    type: 'func';
    name: string;
    parameters: ParameterDef[];
    returns: ParameterDef[];
    locals: ParameterDef[];
    body: Statement;
}

export interface VariableType
{
    type: "type"
    name: string
    isArray : boolean
}

export interface ParameterDef
{
    type:       "param";
    name:       string;
    varType:    VariableType;
}

export type LValue = (SingleLValue | ArrLValue);

export interface SingleLValue {
  type: "lsingvar";
  name: string;
}

export interface ArrLValue {
  type: "larr";
  name: string;
  index: Expr;
}

// Statements

export type Statement = (AssignmentSt | ConditionalSt | LoopSt | BlockSt);

export interface AssignmentSt {
    type: "assign_st";
    left: LValue[];
    right: Expr[];
}

export interface ConditionalSt {
    type: "cond_st";
    condition: Condition;
    then: Statement;
    else: Statement | null;
}

export interface LoopSt {
    type: "loop_st";
    condition: Condition;
    invariant: Predicate | null;
    body: Statement;
}

export interface BlockSt {
    type: "block_st";
    stmts: Statement[];
}

export type Expr = (arith.Expr | FuncCallExpr | ArrAccessExpr);

export interface FuncCallExpr {
    type: "funccall";
    name: string;
    args: Expr[]; 
}

export interface ArrAccessExpr {
    type: "arraccess";
    name: string;
    index: Expr;
}

export type Condition = (True | False | Not | Paren | BinCond | Comp);

export interface True {
    type: "true";
}

export interface False {
    type: "false";
}

export interface Not {
    type: "not";
    condition: Condition;
}

export interface Paren {
    type: "paren";
    inner: Condition;   
}

export type BinCond = AndCond | OrCond | ImplCond;

export interface AndCond {
    type: "and";
    left: Condition;
    right: Condition;
}

export interface OrCond {
    type: "or";
    left: Condition;
    right: Condition;
}

export interface ImplCond {
    type: "impl";
    left: Condition;
    right: Condition;
}

export interface Comp {
    type: "comp";
    left: Expr;
    op: "==" | "!=" | ">" | "<" | ">=" | "<=";
    right: Expr;
}

// Предикаты и формулы

export type Predicate = (Quantifier | FormulaRef | False | True | Comp | NotPred | BinPred | ParenPred);

export interface Quantifier {
    type: "quantifier";
    quant: "forall" | "exists";
    varName: string;
    varType: "int" | "int[]";
    body: Predicate;
}

export interface FormulaRef {
    type: "formula";
    name: string;
    parameters: ParameterDef[];
}

export interface NotPred {
    type: "not";
    predicate: Predicate;
}

export type BinPred = AndPred | OrPred; 

export interface AndPred {
    type: "and";
    left: Predicate;
    right: Predicate;
}

export interface OrPred {
    type: "or";
    left: Predicate;
    right: Predicate;
}

export interface ParenPred {
    type: "paren";
    inner: Predicate;
}