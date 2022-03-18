use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};
use zo::{self, program::ZoAbi as Zo, Cache, Control, Margin, OrderType, State};

declare_id!("Eg8fBwr5N3P9HTUZsKJ5LZP3jVRgBJcrnvAcY35G5rTw");

#[program]
pub mod zo_abi_example {
    use super::*;

    pub fn do_create_margin(cx: Context<DoCreateMargin>, zo_margin_nonce: u8) -> ProgramResult {
        msg!("Calling create_margin.rs through CPI");

        let cpi_program = cx.accounts.zo_program.to_account_info();
        let cpi_accounts = zo::cpi::accounts::CreateMargin {
            state: cx.accounts.zo_program_state.to_account_info(),
            payer: cx.accounts.authority.to_account_info(),
            authority: cx.accounts.authority.to_account_info(),
            margin: cx.accounts.zo_program_margin.to_account_info(),
            control: cx.accounts.control.to_account_info(),
            rent: cx.accounts.rent.to_account_info(),
            system_program: cx.accounts.system_program.to_account_info(),
        };
        let cpi_cx = CpiContext::new(cpi_program, cpi_accounts);
        zo::cpi::create_margin(cpi_cx, zo_margin_nonce)?;
        Ok(())
    }

    pub fn do_deposit(cx: Context<DoDeposit>, amount: u64) -> ProgramResult {
        msg!("Calling deposit.rs through CPI with amount {}", amount);

        let cpi_program = cx.accounts.zo_program.to_account_info();
        let cpi_accounts = zo::cpi::accounts::Deposit {
            state: cx.accounts.zo_program_state.to_account_info(),
            state_signer: cx.accounts.state_signer.to_account_info(),
            cache: cx.accounts.cache.to_account_info(),
            authority: cx.accounts.authority.to_account_info(),
            margin: cx.accounts.zo_program_margin.to_account_info(),
            token_account: cx.accounts.token_account.to_account_info(),
            vault: cx.accounts.zo_program_vault.to_account_info(),
            token_program: cx.accounts.token_program.to_account_info(),
        };
        let cpi_cx = CpiContext::new(cpi_program, cpi_accounts);
        zo::cpi::deposit(cpi_cx, false, amount)?;
        Ok(())
    }
    pub fn do_withdraw(cx: Context<DoWithdraw>, amount: u64) -> ProgramResult {
        msg!("Calling withdraw.rs through CPI with amount {}", amount);

        let cpi_program = cx.accounts.zo_program.to_account_info();
        let cpi_accounts = zo::cpi::accounts::Withdraw {
            state: cx.accounts.zo_program_state.to_account_info(),
            state_signer: cx.accounts.state_signer.to_account_info(),
            cache: cx.accounts.cache.to_account_info(),
            control: cx.accounts.control.to_account_info(),
            authority: cx.accounts.authority.to_account_info(),
            margin: cx.accounts.zo_program_margin.to_account_info(),
            token_account: cx.accounts.token_account.to_account_info(),
            vault: cx.accounts.zo_program_vault.to_account_info(),
            token_program: cx.accounts.token_program.to_account_info(),
        };
        let cpi_cx = CpiContext::new(cpi_program, cpi_accounts);
        zo::cpi::withdraw(cpi_cx, false, amount)?;
        Ok(())
    }

    pub fn do_create_perp_open_orders(cx: Context<DoCreatePerpOpenOrders>) -> ProgramResult {
        msg!("calling create_perp_open_orders.rs through CPI");

        let cpi_program = cx.accounts.zo_program.to_account_info();
        let cpi_accounts = zo::cpi::accounts::CreatePerpOpenOrders {
            state: cx.accounts.zo_program_state.to_account_info(),
            state_signer: cx.accounts.state_signer.to_account_info(),
            authority: cx.accounts.authority.to_account_info(),
            payer: cx.accounts.authority.to_account_info(),
            margin: cx.accounts.zo_program_margin.to_account_info(),
            control: cx.accounts.control.to_account_info(),
            open_orders: cx.accounts.open_orders.to_account_info(),
            dex_market: cx.accounts.dex_market.to_account_info(),
            dex_program: cx.accounts.dex_program.to_account_info(),
            rent: cx.accounts.rent.to_account_info(),
            system_program: cx.accounts.system_program.to_account_info(),
        };
        let cpi_cx = CpiContext::new(cpi_program, cpi_accounts);
        zo::cpi::create_perp_open_orders(cpi_cx)?;
        Ok(())
    }

    pub fn do_place_perp_order(
        cx: Context<DoPlacePerpOrder>,
        is_long: bool,
        limit_price: u64,
        max_base_quantity: u64,
        max_quote_quantity: u64,
        client_id: u64,
        limit: u16,
    ) -> ProgramResult {
        msg!("calling place_perp_order.rs through CPI");

        let cpi_program = cx.accounts.zo_program.to_account_info();
        let cpi_accounts = zo::cpi::accounts::PlacePerpOrder {
            state: cx.accounts.zo_program_state.to_account_info(),
            state_signer: cx.accounts.state_signer.to_account_info(),
            cache: cx.accounts.cache.to_account_info(),
            authority: cx.accounts.authority.to_account_info(),
            margin: cx.accounts.zo_program_margin.to_account_info(),
            control: cx.accounts.control.to_account_info(),
            open_orders: cx.accounts.open_orders.to_account_info(),
            dex_market: cx.accounts.dex_market.to_account_info(),
            req_q: cx.accounts.req_q.to_account_info(),
            event_q: cx.accounts.event_q.to_account_info(),
            market_bids: cx.accounts.market_bids.to_account_info(),
            market_asks: cx.accounts.market_asks.to_account_info(),
            dex_program: cx.accounts.dex_program.to_account_info(),
            rent: cx.accounts.rent.to_account_info(),
        };
        let cpi_cx = CpiContext::new(cpi_program, cpi_accounts);
        zo::cpi::place_perp_order(
            cpi_cx,
            is_long,
            limit_price,
            max_base_quantity,
            max_quote_quantity,
            OrderType::Limit,
            limit,
            client_id,
        )?;
        Ok(())
    }

    pub fn do_settle_funds(cx: Context<DoSettleFunds>) -> ProgramResult {
        msg!("calling settle_funds.rs through CPI");

        let cpi_program = cx.accounts.zo_program.to_account_info();
        let cpi_accounts = zo::cpi::accounts::SettleFunds {
            authority: cx.accounts.authority.to_account_info(),
            state: cx.accounts.zo_program_state.to_account_info(),
            state_signer: cx.accounts.state_signer.to_account_info(),
            cache: cx.accounts.cache.to_account_info(),
            margin: cx.accounts.zo_program_margin.to_account_info(),
            control: cx.accounts.control.to_account_info(),
            open_orders: cx.accounts.open_orders.to_account_info(),
            dex_market: cx.accounts.dex_market.to_account_info(),
            dex_program: cx.accounts.dex_program.to_account_info(),
        };
        let cpi_cx = CpiContext::new(cpi_program, cpi_accounts);
        zo::cpi::settle_funds(cpi_cx)?;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(zo_margin_nonce: u8)]
pub struct DoCreateMargin<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut)]
    pub zo_program_state: AccountLoader<'info, State>,
    #[account(mut)]
    pub zo_program_margin: UncheckedAccount<'info>,
    pub zo_program: Program<'info, Zo>,
    #[account(mut)]
    pub control: UncheckedAccount<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct DoDeposit<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    pub zo_program_state: AccountLoader<'info, State>,
    #[account(mut)]
    pub zo_program_margin: AccountLoader<'info, Margin>,
    pub zo_program: Program<'info, Zo>,
    pub state_signer: UncheckedAccount<'info>,
    #[account(mut, address = zo_program_state.load()?.cache)]
    pub cache: AccountLoader<'info, Cache>,
    #[account(
        mut,
        constraint = token_account.owner == *authority.key,
    )]
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub zo_program_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct DoWithdraw<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut)]
    pub zo_program_state: AccountLoader<'info, State>,
    #[account(mut)]
    pub zo_program_margin: AccountLoader<'info, Margin>,
    pub zo_program: Program<'info, Zo>,
    #[account(mut)]
    pub state_signer: UncheckedAccount<'info>,
    #[account(mut, address = zo_program_state.load()?.cache)]
    pub cache: AccountLoader<'info, Cache>,
    #[account(mut, address = zo_program_margin.load()?.control)]
    pub control: AccountLoader<'info, Control>,
    #[account(
        mut,
        constraint = token_account.owner == *authority.key,
    )]
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub zo_program_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct DoCreatePerpOpenOrders<'info> {
    pub zo_program: Program<'info, Zo>,
    pub zo_program_state: AccountLoader<'info, State>,
    // this will be checked in 01 program
    // seeds = [zo_program_state.key().as_ref()],
    // bump = zo_program_state.load()?.signer_nonce
    #[account(mut)]
    pub state_signer: UncheckedAccount<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut)]
    // this will be checked in 01 program
    // seeds = [authority.key.as_ref(), zo_program_state.key().as_ref(), b"marginv1".as_ref()],
    // bump = zo_program_margin.load()?.nonce
    pub zo_program_margin: AccountLoader<'info, Margin>,
    #[account(
        mut,
        address = zo_program_margin.load()?.control
    )]
    pub control: AccountLoader<'info, Control>,
    #[account(mut)]
    pub open_orders: UncheckedAccount<'info>,
    //owner should be serum dex id
    #[account(mut)]
    pub dex_market: UncheckedAccount<'info>,
    //address should be serum dex id
    pub dex_program: UncheckedAccount<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DoPlacePerpOrder<'info> {
    pub zo_program: Program<'info, Zo>,
    pub zo_program_state: AccountLoader<'info, State>,
    #[account(mut)]
    // this will be checked in 01 program
    // seeds = [zo_program_state.key().as_ref()],
    // bump = zo_program_state.load()?.signer_nonce
    pub state_signer: UncheckedAccount<'info>,
    #[account(mut, address = zo_program_state.load()?.cache)]
    pub cache: AccountLoader<'info, Cache>,
    pub authority: Signer<'info>,
    #[account(mut)]
    // this will be checked in 01 program
    // seeds = [authority.key.as_ref(), zo_program_state.key().as_ref(), b"marginv1".as_ref()],
    // bump = zo_program_margin.load()?.nonce
    pub zo_program_margin: AccountLoader<'info, Margin>,
    #[account(
        mut,
        address = zo_program_margin.load()?.control
    )]
    pub control: AccountLoader<'info, Control>,
    #[account(mut)]
    pub open_orders: UncheckedAccount<'info>,
    //owner should be serum dex id
    #[account(mut)]
    pub dex_market: UncheckedAccount<'info>,
    #[account(mut)]
    pub req_q: UncheckedAccount<'info>,
    #[account(mut)]
    pub event_q: UncheckedAccount<'info>,
    #[account(mut)]
    pub market_bids: UncheckedAccount<'info>,
    #[account(mut)]
    pub market_asks: UncheckedAccount<'info>,
    //address should be serum dex id
    pub dex_program: UncheckedAccount<'info>,
    pub rent: Sysvar<'info, Rent>,
}
#[derive(Accounts)]
pub struct DoSettleFunds<'info> {
    pub zo_program: Program<'info, Zo>,
    pub authority: Signer<'info>,
    pub zo_program_state: AccountLoader<'info, State>,
    #[account(mut)]
    // this will be checked in 01 program
    // seeds = [zo_program_state.key().as_ref()],
    // bump = zo_program_state.load()?.signer_nonce
    pub state_signer: UncheckedAccount<'info>,
    #[account(mut, address = zo_program_state.load()?.cache)]
    pub cache: AccountLoader<'info, Cache>,
    #[account(mut)]
    // this will be checked in 01 program
    // seeds = [authority.key.as_ref(), zo_program_state.key().as_ref(), b"marginv1".as_ref()],
    // bump = zo_program_margin.load()?.nonce
    pub zo_program_margin: AccountLoader<'info, Margin>,
    #[account(mut, address = zo_program_margin.load()?.control)]
    pub control: AccountLoader<'info, Control>,
    #[account(mut)]
    pub open_orders: UncheckedAccount<'info>,
    #[account(mut)]
    pub dex_market: UncheckedAccount<'info>,
    //address should be serum dex id
    pub dex_program: UncheckedAccount<'info>,
}
