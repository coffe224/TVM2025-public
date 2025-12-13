import { Expr } from "../../lab04";

export function derive(e: Expr, varName: string): Expr
{
    console.log("Entered the derive function with type: " + e.type);

    switch(e.type) {
        case 'add_op':
        {
            const new_expr : Expr = {
                type: 'add_op', 
                op: '+', 
                left_arg: derive(e.left_arg, varName), 
                right_arg: derive(e.right_arg, varName)};
            return new_expr;
        }

        case 'sub_op':
        {
            const new_expr : Expr = {
                type: 'sub_op', 
                op: '-', 
                left_arg: derive(e.left_arg, varName), 
                right_arg: derive(e.right_arg, varName)};
            return new_expr;
        }

        case 'mul_op':
        {
            const f_expr : Expr = e.left_arg;
            const f_deriv_expr : Expr = derive(f_expr, varName);


            const g_expr : Expr = e.right_arg;
            const g_deriv_expr : Expr = derive(g_expr, varName);

            const f_deriv_times_g : Expr = {
                type: 'mul_op',
                op: '*', 
                left_arg: f_deriv_expr,
                right_arg: g_expr};

            const f_times_g_deriv : Expr = {
                type: 'mul_op',
                op: '*', 
                left_arg: f_expr,
                right_arg: g_deriv_expr};
            
            const new_expr : Expr = {
                type: 'add_op', 
                op: '+', 
                left_arg: f_deriv_times_g, 
                right_arg: f_times_g_deriv};
            return new_expr;
        }

        case 'div_op':
        {
            const f_expr : Expr = e.left_arg;
            const f_deriv_expr : Expr = derive(f_expr, varName);


            const g_expr : Expr = e.right_arg;
            const g_deriv_expr : Expr = derive(g_expr, varName);

            const f_deriv_times_g : Expr = {
                type: 'mul_op',
                op: '*', 
                left_arg: f_deriv_expr,
                right_arg: g_expr};

            const f_times_g_deriv : Expr = {
                type: 'mul_op',
                op: '*', 
                left_arg: f_expr,
                right_arg: g_deriv_expr};
            
            const numerator : Expr = {
                type: 'sub_op', 
                op: '-', 
                left_arg: f_deriv_times_g, 
                right_arg: f_times_g_deriv};

            const denominator : Expr = {
                type: 'mul_op',
                op: '*', 
                left_arg: g_expr,
                right_arg: g_expr};

            const new_expr : Expr = {
                type: 'div_op', 
                op: '/', 
                left_arg: numerator, 
                right_arg: denominator};

            return new_expr;
        }

        case 'variable':
        {
            console.log("Varname: " + varName + " | Variable: " + e.value);
            const new_expr : Expr = {type: 'number', value: 0}
            if (e.value == varName) {
                console.log(e.value);
                new_expr.value = 1;
            }
            return new_expr;
        }

        case 'unary_min':
        {
            const new_expr : Expr = {type: 'unary_min', arg: derive(e.arg, varName)};
            return new_expr;
        }

        case 'number':
        {
            console.log("Number: " + e.value);
            const new_expr : Expr = {type: 'number', value: 0}
            return new_expr;
        }


    }
}
function isZero(e: Expr): boolean { throw "Not implemented"}

function isOne(e: Expr): boolean  { throw "Not implemented"}
