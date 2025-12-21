import { Expr } from "../../lab04";

function exprEquals(a: Expr, b: Expr): boolean {
    switch (a.type) {
        case 'add_op':
        case 'sub_op':
        case 'mul_op':
        case 'div_op':
            if (b.type !== a.type) return false;
            return exprEquals(a.left_arg, b.left_arg) && exprEquals(a.right_arg, b.right_arg);
        
        case 'unary_min':
            if (b.type !== 'unary_min') return false;
            return exprEquals(a.arg, b.arg);
        
        case 'variable':
            if (b.type !== 'variable') return false;
            return a.value === b.value;
        
        case 'number':
            if (b.type !== 'number') return false;
            return a.value === b.value;
    }
}

function copyExpr(expr: Expr): Expr {
    switch (expr.type) {
        case 'number':
            return { type: 'number', value: expr.value };
        case 'variable':
            return { type: 'variable', value: expr.value };
        case 'unary_min':
            return { type: 'unary_min', arg: copyExpr(expr.arg) };
        case 'add_op':
            return { type: 'add_op', op: '+', left_arg: copyExpr(expr.left_arg), right_arg: copyExpr(expr.right_arg) };
        case 'sub_op':
            return { type: 'sub_op', op: '-', left_arg: copyExpr(expr.left_arg), right_arg: copyExpr(expr.right_arg) };
        case 'mul_op':
            return { type: 'mul_op', op: '*', left_arg: copyExpr(expr.left_arg), right_arg: copyExpr(expr.right_arg) };
        case 'div_op':
            return { type: 'div_op', op: '/', left_arg: copyExpr(expr.left_arg), right_arg: copyExpr(expr.right_arg) };
    }
}


export function simplify(e: Expr, identities: [Expr, Expr][]): Expr {
    for (const [pattern, replacement] of identities) {
        const bindings = match(e, pattern);
        if (bindings !== null) {
            const simplified = substitute(replacement, bindings);
            return simplify(simplified, identities);
        }
    }    
    return simplifyChildren(e, identities);
}

function match(expr: Expr, pattern: Expr): Map<string, Expr> | null {
    if (pattern.type === 'variable') {
        const bindings = new Map<string, Expr>();
        bindings.set(pattern.value, expr);
        return bindings;
    }
    
    if (expr.type !== pattern.type) {
        return null;
    }
    
    // Handle different expression types
    switch (expr.type) {
        case 'number':
            const numPattern = pattern as typeof expr;
            return (expr as any).value === (pattern as any).value ? new Map() : null;
        
        case 'unary_min':
            const unaryPattern = pattern as typeof expr;
            return match(expr.arg, unaryPattern.arg);
        
        case 'add_op':
        case 'sub_op':
        case 'mul_op':
        case 'div_op':
            const binExpr = expr as any;
            const binPattern = pattern as any;
            
            const leftBindings = match(binExpr.left_arg, binPattern.left_arg);
            if (leftBindings === null) return null;
            
            const rightBindings = match(binExpr.right_arg, binPattern.right_arg);
            if (rightBindings === null) return null;
            
            // Merge bindings, checking for consistency
            return mergeBindings(leftBindings, rightBindings);
    }
}

// Merge two sets of bindings, return null if inconsistent
function mergeBindings(b1: Map<string, Expr>, b2: Map<string, Expr>): Map<string, Expr> | null {
    const result = new Map(b1);
    
    for (const [key, value] of b2) {
        if (result.has(key)) {
            // Check if the bound expressions are equal
            if (!exprEquals(result.get(key)!, value)) {
                return null; // Inconsistent binding
            }
        } else {
            result.set(key, value);
        }
    }
    
    return result;
}

// Substitute variable bindings into an expression
function substitute(expr: Expr, bindings: Map<string, Expr>): Expr {
    // If expr is a variable, replace it with its binding
    if (expr.type === 'variable' && bindings.has(expr.value)) {
        return bindings.get(expr.value)!;
    }
    
    // Otherwise, recursively substitute in children
    switch (expr.type) {
        case 'number':
        case 'variable':
            return { ...expr };
        
        case 'unary_min':
            return {
                ...expr,
                arg: substitute(expr.arg, bindings)
            };
        
        case 'add_op':
        case 'sub_op':
        case 'mul_op':
        case 'div_op':
            const binExpr = expr as any;
            return {
                ...binExpr,
                left_arg: substitute(binExpr.left_arg, bindings),
                right_arg: substitute(binExpr.right_arg, bindings)
            };
    }
}

// Recursively simplify children of an expression
function simplifyChildren(e: Expr, identities: [Expr, Expr][]): Expr {
    switch (e.type) {
        case 'number':
        case 'variable':
            return e;
        
        case 'unary_min':
            const simplifiedArg = simplify(e.arg, identities);
            // Try to simplify the entire expression with the simplified argument
            const newUnary = { type: 'unary_min' as const, arg: simplifiedArg };
            return simplify(newUnary, identities);
        
        case 'add_op':
        case 'sub_op':
        case 'mul_op':
        case 'div_op':
            const binExpr = e as any;
            const simplifiedLeft = simplify(binExpr.left_arg, identities);
            const simplifiedRight = simplify(binExpr.right_arg, identities);
            
            // Create new expression with simplified children
            const newBin = {
                ...binExpr,
                left_arg: simplifiedLeft,
                right_arg: simplifiedRight
            };
            
            // Try to simplify the entire new expression
            return simplify(newBin, identities);
        
        default:
            return e;
    }
}